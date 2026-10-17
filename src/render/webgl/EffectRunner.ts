import type { EffectInstance, EffectParamValue } from '../../types';
import {
  buildFragmentShader, evalExpression, ISF_VERTEX, paramValue, type IsfInput, type IsfShader,
} from '../../effects/isf';
import type { AudioSnapshot } from '../../audio/audioBus';
import { SPECTRUM_SIZE, WAVEFORM_SIZE } from '../../audio/analysis';

// ---------------------------------------------------------------------------
// Runs ISF effect stacks and generators on the GPU. A stack takes a texture
// (or nothing, for a generator) through each enabled effect's passes into
// render targets owned by that stack, and hands back the last one.
//
// Orientation: ISF puts (0,0) at the bottom left. Media textures are stored
// top row first, so the first pass reads them flipped (`_inputImage_flip`);
// everything the runner renders is bottom-up ("yUp"), which the frame shader
// and the final present account for.
//
// Audio inputs get the analysis of the audio input as one-row images:
// `audio` the waveform (0.5 = silence), `audioFFT` the spectrum (0..1,
// 0 Hz … Nyquist), resampled to the input's MAX columns when it has one.
// ---------------------------------------------------------------------------

export interface RunnerTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  yUp: boolean; // bottom row first (rendered here); false: top row first (media)
}

export interface ResolvedEffect {
  instance: Pick<EffectInstance, 'id' | 'enabled'> & { params: Record<string, EffectParamValue> };
  shader: IsfShader;
  key: string; // `${effectId}#${source hash}`: one program per shader version
}

export interface EffectTiming {
  time: number; // s since the session started (shared by all windows)
  delta: number; // s since the last frame
  frame: number;
  bpm: number;
  beat: number; // beats of the master clock
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Buffer {
  textures: [WebGLTexture, WebGLTexture];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  read: 0 | 1; // the side holding the last result
  width: number;
  height: number;
  float: boolean;
  usedFrame: number;
}

// Buffers not used for this many frames are released
const BUFFER_TTL_FRAMES = 120;

interface AudioTexture {
  texture: WebGLTexture;
  width: number;
  audio: AudioSnapshot | null | undefined; // what it shows (undefined: nothing yet)
}

const SILENT_SPECTRUM = new Uint8Array(SPECTRUM_SIZE);
const SILENT_WAVE = new Uint8Array(WAVEFORM_SIZE).fill(128);

/** `width` columns from `source`: the loudest value of each group (or interpolated when growing). */
export const resampleAudio = (source: Uint8Array, width: number, peak: boolean): Uint8Array => {
  if (width === source.length) return source;
  const out = new Uint8Array(width);
  for (let i = 0; i < width; i++) {
    const from = (i * source.length) / width;
    const to = ((i + 1) * source.length) / width;
    if (to - from <= 1) {
      out[i] = source[Math.min(source.length - 1, Math.floor(from))];
      continue;
    }
    let acc = 0;
    let count = 0;
    for (let j = Math.floor(from); j < Math.ceil(to); j++) {
      acc = peak ? Math.max(acc, source[j]) : acc + source[j];
      count++;
    }
    out[i] = peak ? acc : Math.round(acc / count);
  }
  return out;
};

export class EffectRunner {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, Program | { error: string }>();
  private buffers = new Map<string, Buffer>();
  private vao: WebGLVertexArrayObject;
  private black: WebGLTexture;
  private floatTargets: boolean;
  private frame = 0;
  private timing: EffectTiming = { time: 0, delta: 0, frame: 0, bpm: 120, beat: 0 };
  private audio: AudioSnapshot | null = null;
  private audioTextures = new Map<string, AudioTexture>();
  // A shader failed to compile (effect id, message) — shown in the effect editor
  private onError: (effectId: string, message: string) => void;

  constructor(gl: WebGL2RenderingContext, onError: (effectId: string, message: string) => void = () => {}) {
    this.gl = gl;
    this.onError = onError;
    this.vao = gl.createVertexArray()!;
    this.black = this.createBlack();
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
  }

  /** After a context loss everything is gone. */
  reset(): void {
    this.programs.clear();
    this.buffers.clear();
    this.audioTextures.clear();
    this.vao = this.gl.createVertexArray()!;
    this.black = this.createBlack();
    this.floatTargets = !!this.gl.getExtension('EXT_color_buffer_float');
  }

  beginFrame(timing: EffectTiming, audio: AudioSnapshot | null = null): void {
    this.frame++;
    this.timing = timing;
    this.audio = audio;
  }

  /** Free render targets nobody used lately (removed effects, cleared layers). */
  endFrame(): void {
    for (const [key, buffer] of this.buffers) {
      if (this.frame - buffer.usedFrame > BUFFER_TTL_FRAMES) {
        this.deleteBuffer(buffer);
        this.buffers.delete(key);
      }
    }
  }

  dispose(): void {
    for (const buffer of this.buffers.values()) this.deleteBuffer(buffer);
    this.buffers.clear();
    for (const p of this.programs.values()) if ('program' in p) this.gl.deleteProgram(p.program);
    this.programs.clear();
    for (const a of this.audioTextures.values()) this.gl.deleteTexture(a.texture);
    this.audioTextures.clear();
  }

  /** Compile a shader now (the ?isf-check page); returns the error, if any. */
  check(effect: ResolvedEffect): string | null {
    const p = this.program(effect);
    return 'error' in p ? p.error : null;
  }

  /**
   * Run a stack at `size` (RENDERSIZE). `input` is null for a generator (the
   * first effect makes the image). Returns the input unchanged when nothing ran.
   */
  run(
    stackKey: string,
    input: RunnerTexture | null,
    effects: ResolvedEffect[],
    size: { width: number; height: number },
  ): RunnerTexture | null {
    let current = input;
    for (const effect of effects) {
      if (!effect.instance.enabled) continue;
      const program = this.program(effect);
      if ('error' in program) continue;
      current = this.runEffect(`${stackKey}|${effect.instance.id}`, program, effect, current, size);
    }
    return current;
  }

  // ---- One effect -------------------------------------------------------------------

  private runEffect(
    key: string,
    program: Program,
    effect: ResolvedEffect,
    input: RunnerTexture | null,
    size: { width: number; height: number },
  ): RunnerTexture {
    const gl = this.gl;
    const { shader, instance } = effect;
    const { width, height } = size;

    // Values for size expressions: $WIDTH, $HEIGHT and number inputs
    const vars: Record<string, number> = { WIDTH: width, HEIGHT: height };
    for (const i of shader.inputs) {
      const v = paramValue(i, instance.params[i.name]);
      if (typeof v === 'number') vars[i.name] = v;
    }
    const passSize = (expression: string | undefined, fallback: number) => {
      if (!expression) return fallback;
      try {
        const v = evalExpression(expression, vars);
        return Number.isFinite(v) ? Math.max(1, Math.min(8192, Math.round(v))) : fallback;
      } catch {
        return fallback;
      }
    };

    gl.useProgram(program.program);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    let output: RunnerTexture | null = null;

    shader.passes.forEach((pass, index) => {
      const w = passSize(pass.width, width);
      const h = passSize(pass.height, height);
      const bufferKey = `${key}|${pass.target ?? `#${index}`}`;
      const buffer = this.buffer(bufferKey, w, h, pass.float && this.floatTargets);
      const write = (1 - buffer.read) as 0 | 1;

      let unit = 0;
      const u = (name: string) => this.uniform(program, name);
      const bindImage = (name: string, image: RunnerTexture | null) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, image?.texture ?? this.black);
        gl.uniform1i(u(name), unit);
        gl.uniform2f(u(`_${name}_imgSize`), image?.width ?? 1, image?.height ?? 1);
        gl.uniform4f(u(`_${name}_imgRect`), 0, 0, image?.width ?? 1, image?.height ?? 1);
        gl.uniform1i(u(`_${name}_flip`), image && !image.yUp ? 1 : 0);
        unit++;
      };

      gl.uniform1i(u('PASSINDEX'), index);
      gl.uniform2f(u('RENDERSIZE'), w, h);
      gl.uniform1f(u('TIME'), this.timing.time);
      gl.uniform1f(u('TIMEDELTA'), this.timing.delta);
      gl.uniform1i(u('FRAMEINDEX'), this.timing.frame);
      const now = new Date();
      gl.uniform4f(u('DATE'), now.getFullYear(), now.getMonth() + 1, now.getDate(),
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000);
      gl.uniform1f(u('BPM'), this.timing.bpm);
      gl.uniform1f(u('BEAT'), this.timing.beat);

      for (const i of shader.inputs) {
        const loc = u(i.name);
        const v = paramValue(i, instance.params[i.name]);
        switch (i.type) {
          case 'float': gl.uniform1f(loc, v as number); break;
          case 'long': gl.uniform1i(loc, Math.round(v as number)); break;
          case 'bool':
          case 'event': gl.uniform1i(loc, v ? 1 : 0); break;
          case 'color': gl.uniform4fv(loc, v as number[]); break;
          case 'point2D': gl.uniform2fv(loc, v as number[]); break;
          case 'image': bindImage(i.name, i.name === 'inputImage' || i.name === 'startImage' ? input : null); break;
          case 'audio':
          case 'audioFFT': bindImage(i.name, this.audioImage(i)); break;
        }
      }
      // Pass targets read their last result — never the side being written
      for (const p of shader.passes) {
        if (!p.target || shader.inputs.some(i => i.name === p.target)) continue;
        const b = this.buffers.get(`${key}|${p.target}`);
        bindImage(p.target, b ? { texture: b.textures[b.read], width: b.width, height: b.height, yUp: true } : null);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffers[write]);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      buffer.read = write;
      // Leave no render target bound to a texture unit
      for (let t = 0; t < unit; t++) {
        gl.activeTexture(gl.TEXTURE0 + t);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      output = { texture: buffer.textures[write], width: w, height: h, yUp: true };
    });
    return output!;
  }

  // ---- Programs and targets ------------------------------------------------------------

  private program(effect: ResolvedEffect): Program | { error: string } {
    const cached = this.programs.get(effect.key);
    if (cached) return cached;
    const gl = this.gl;
    let result: Program | { error: string };
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
          const log = gl.getShaderInfoLog(shader) ?? 'compile failed';
          gl.deleteShader(shader);
          throw new Error(log.trim());
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, ISF_VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, buildFragmentShader(effect.shader));
      const program = gl.createProgram()!;
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
      }
      result = { program, uniforms: new Map() };
    } catch (error) {
      result = { error: (error as Error).message };
      this.onError(effect.key.split('#')[0], result.error);
    }
    this.programs.set(effect.key, result);
    return result;
  }

  private uniform(p: Program, name: string): WebGLUniformLocation | null {
    if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
    return p.uniforms.get(name)!;
  }

  private buffer(key: string, width: number, height: number, float: boolean): Buffer {
    const existing = this.buffers.get(key);
    if (existing && existing.width === width && existing.height === height && existing.float === float) {
      existing.usedFrame = this.frame;
      return existing;
    }
    if (existing) this.deleteBuffer(existing);
    const gl = this.gl;
    const make = (): [WebGLTexture, WebGLFramebuffer] => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const framebuffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      // Start transparent (persistent buffers read this on the first frame)
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return [texture, framebuffer];
    };
    const [t0, f0] = make();
    const [t1, f1] = make();
    gl.bindTexture(gl.TEXTURE_2D, null);
    const buffer: Buffer = {
      textures: [t0, t1], framebuffers: [f0, f1], read: 0, width, height, float, usedFrame: this.frame,
    };
    this.buffers.set(key, buffer);
    return buffer;
  }

  private deleteBuffer(buffer: Buffer) {
    const gl = this.gl;
    buffer.textures.forEach(t => gl.deleteTexture(t));
    buffer.framebuffers.forEach(f => gl.deleteFramebuffer(f));
  }

  /** The audio input as an image for an `audio` / `audioFFT` input (one row, top = bottom). */
  private audioImage(input: IsfInput): RunnerTexture {
    const fft = input.type === 'audioFFT';
    const native = fft ? SPECTRUM_SIZE : WAVEFORM_SIZE;
    const max = typeof input.max === 'number' && input.max >= 1 ? Math.round(input.max) : native;
    const width = Math.min(native, max);
    const key = `${input.type}:${width}`;
    const gl = this.gl;
    let entry = this.audioTextures.get(key);
    if (!entry) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      entry = { texture, width, audio: undefined };
      this.audioTextures.set(key, entry);
    }
    if (entry.audio !== this.audio) {
      const source = fft ? this.audio?.spectrum ?? SILENT_SPECTRUM : this.audio?.waveform ?? SILENT_WAVE;
      const values = resampleAudio(source, width, fft);
      const rgba = new Uint8Array(width * 4);
      for (let i = 0; i < width; i++) {
        rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = values[i];
        rgba[i * 4 + 3] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      entry.audio = this.audio;
    }
    // One row: the same either way up
    return { texture: entry.texture, width, height: 1, yUp: true };
  }

  private createBlack(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
}
