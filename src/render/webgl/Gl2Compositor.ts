import type { MediaFrame, Point } from '../../types';
import type { RenderScene, SceneRenderer } from '../types';
import { frameRenderParams, MAX_POLYGON_VERTICES } from '../frameMath';
import { fadeProgress, transitionMs } from '../../state/transitions';
import { drawTestCard } from '../testCardCanvas';
import { MediaPool, type MediaItem, type MediaTexture } from './MediaPool';
import {
  QUAD_VERTEX, FULLSCREEN_VERTEX, COPY_FRAGMENT, BACKGROUND_FRAGMENT, FRAME_FRAGMENT, BLEND_MODE_CODES,
} from './shaders';

// ---------------------------------------------------------------------------
// WebGL2 compositor: background + frames into an offscreen target, then the
// master fader on the way to the canvas. Normal-blended frames use GPU
// blending; other blend modes read the layers below from a ping-pong copy.
// ---------------------------------------------------------------------------

const BACKGROUND_KEY = '__background__';
const PLACEHOLDER_FILL: [number, number, number, number] = [243 / 255, 244 / 255, 246 / 255, 1];
// Grow drawn quads so antialiased edges aren't cut by rasterization
const EDGE_PAD_PX = 2;

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

interface FrameSource {
  texture: MediaTexture;
  fit: 0 | 1;
}

// What a frame shows: its media, and the frame as it was then (the clip's look)
interface Shown {
  item: MediaItem;
  frame: MediaFrame;
}

// A dissolve on a frame: from the clip that was shown to the current one
// (or to nothing when the layer was cleared)
interface Fade {
  from: Shown;
  start: number; // performance.now()
  ms: number;
}

// What drawFrame mixes: the current source and, during a dissolve, the old one
interface FrameDraw {
  source: FrameSource | null;
  from: { source: FrameSource; frame: MediaFrame; mix: number } | null;
}

const hexToRgba = (hex: string): [number, number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

export class Gl2Compositor implements SceneRenderer {
  readonly kind = 'gpu' as const;
  private gl: WebGL2RenderingContext;
  private frameProgram!: Program;
  private backgroundProgram!: Program;
  private copyProgram!: Program;
  private quadBuffer!: WebGLBuffer;
  private quadVao!: WebGLVertexArrayObject;
  private emptyVao!: WebGLVertexArrayObject;
  private targets: Target[] = [];
  private pool: MediaPool;
  private testCards = new Map<string, MediaTexture>();
  private lost = false;
  private width = 1;
  private height = 1;
  private lastScene: RenderScene | null = null;
  private lastCompositionWidth = 0;
  // Per frame, the media last drawn: after a trigger it stays on screen
  // (and playing) until the new clip has a frame to show — no black gap —
  // then dissolves into it over the frame's transition
  private shown = new Map<string, Shown>();
  private fades = new Map<string, Fade>();

  /** null when WebGL2 isn't available. */
  static create(canvas: HTMLCanvasElement): Gl2Compositor | null {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    return gl ? new Gl2Compositor(canvas, gl) : null;
  }

  private canvas: HTMLCanvasElement;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.pool = new MediaPool(gl);
    this.initResources();
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  // ---- GPU resources (re-created after a context loss) ---------------------

  private initResources() {
    const gl = this.gl;
    this.frameProgram = this.createProgram(QUAD_VERTEX, FRAME_FRAGMENT);
    this.backgroundProgram = this.createProgram(FULLSCREEN_VERTEX, BACKGROUND_FRAGMENT);
    this.copyProgram = this.createProgram(FULLSCREEN_VERTEX, COPY_FRAGMENT);

    this.quadBuffer = gl.createBuffer()!;
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 12 * 4, gl.DYNAMIC_DRAW);
    const location = gl.getAttribLocation(this.frameProgram.program, 'a_position');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    this.targets = [];
    this.testCards.clear();
    this.createTargets();
  }

  private createProgram(vertexSource: string, fragmentSource: string): Program {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    return { program, uniforms: new Map() };
  }

  private uniform(p: Program, name: string): WebGLUniformLocation | null {
    if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
    return p.uniforms.get(name)!;
  }

  private createTargets() {
    const gl = this.gl;
    for (const target of this.targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    this.targets = [0, 1].map(() => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const framebuffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, framebuffer };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private onContextLost = (event: Event) => {
    event.preventDefault(); // allow restoration
    this.lost = true;
    console.warn('GPU renderer: WebGL context lost — waiting for restore');
  };

  private onContextRestored = () => {
    this.initResources();
    this.pool.resetTextures(this.gl);
    this.lost = false;
    this.lastScene = null; // force a redraw
    console.info('GPU renderer: WebGL context restored');
  };

  // ---- Public API --------------------------------------------------------------

  resize(width: number, height: number): void {
    const maxSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
    const w = Math.max(1, Math.min(maxSize, Math.round(width)));
    const h = Math.max(1, Math.min(maxSize, Math.round(height)));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    if (!this.lost) this.createTargets();
    this.lastScene = null;
  }

  render(scene: RenderScene): void {
    if (this.lost || this.gl.isContextLost()) return;
    this.pool.update(this.mediaItems(scene), scene.outputGain, scene.playback);
    // Skip identical frames: same scene object, no new video frames, no dissolve running
    const newFrames = this.pool.consumeNewFrames();
    if (scene === this.lastScene && !newFrames && this.fades.size === 0) return;
    this.lastScene = scene;
    this.lastCompositionWidth = scene.composition.width;

    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    let current = 0;

    // Background
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[current].framebuffer);
    gl.disable(gl.BLEND);
    this.drawBackground(scene);

    // Frames, bottom to top (same order as the DOM stacking)
    const frames = scene.frames
      .map((frame, index) => ({ frame, index }))
      .sort((a, b) => a.frame.zIndex - b.frame.zIndex || a.index - b.index)
      .map(({ frame }) => frame);

    const now = performance.now();
    for (const frame of frames) {
      const draw = this.frameDraw(scene, frame, now);
      // Placeholders only for frames that never got media (a cleared
      // launcher layer is simply off)
      if (!draw.source && !draw.from && (!scene.showPlaceholders || frame.layerHasClips)) continue;
      const blendMode = BLEND_MODE_CODES[frame.blendMode] ?? 0;
      if (blendMode === 0) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[current].framebuffer);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.drawFrame(scene, frame, draw, 0, null);
      } else {
        // Copy what's below, then draw the frame reading it as the backdrop
        const next = 1 - current;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[next].framebuffer);
        gl.disable(gl.BLEND);
        this.copy(this.targets[current].texture, 1);
        this.drawFrame(scene, frame, draw, blendMode, this.targets[current].texture);
        current = next;
      }
    }

    // Present with the master fader
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    this.copy(this.targets[current].texture, scene.masterOpacity);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.pool.dispose();
    const gl = this.gl;
    for (const card of this.testCards.values()) gl.deleteTexture(card.texture);
    for (const target of this.targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ---- Drawing -------------------------------------------------------------------

  // The media a frame plays: its layer's clip (shared by the layer's surfaces)
  private frameItem(scene: RenderScene, frame: MediaFrame): MediaItem | null {
    if (frame.testPattern || !frame.url) return null;
    return {
      key: frame.clipId ? `clip:${frame.clipId}` : frame.id,
      url: frame.url,
      type: frame.type,
      loop: frame.loop,
      muted: frame.muted,
      playbackRate: frame.playbackRate,
      active: true,
      startSeq: frame.layerId ? scene.layerTriggers[frame.layerId] ?? 0 : 0,
      layerId: frame.layerId,
    };
  }

  private mediaItems(scene: RenderScene): MediaItem[] {
    const items = new Map<string, MediaItem>();
    const bg = scene.background;
    if (bg.type !== 'color' && bg.url) {
      items.set(BACKGROUND_KEY, {
        key: BACKGROUND_KEY, url: bg.url, type: bg.type, loop: bg.loop ?? true, muted: bg.muted ?? true,
        playbackRate: 1, active: true, startSeq: 0,
      });
    }
    const frameIds = new Set<string>();
    for (const frame of scene.frames) {
      frameIds.add(frame.id);
      const item = this.frameItem(scene, frame);
      if (item) items.set(item.key, item);
    }
    // Media still on screen while a triggered clip loads, or dissolving
    // away, keeps playing
    for (const [frameId, held] of this.shown) {
      if (!frameIds.has(frameId)) this.shown.delete(frameId);
      else if (!items.has(held.item.key)) items.set(held.item.key, { ...held.item, active: true });
    }
    for (const [frameId, fade] of this.fades) {
      if (!frameIds.has(frameId)) this.fades.delete(frameId);
      else if (!items.has(fade.from.item.key)) items.set(fade.from.item.key, { ...fade.from.item, active: true });
    }
    for (const p of scene.preload) {
      const key = `clip:${p.clipId}`;
      if (items.has(key)) continue;
      items.set(key, {
        key, url: p.url, type: p.type, loop: p.loop, muted: p.muted, playbackRate: p.playbackRate,
        active: false, startSeq: scene.layerTriggers[p.layerId] ?? 0, layerId: p.layerId,
      });
    }
    return [...items.values()];
  }

  private frameDraw(scene: RenderScene, frame: MediaFrame, now: number): FrameDraw {
    const source = this.frameSource(scene, frame, now);
    const fade = this.fades.get(frame.id);
    if (!fade) return { source, from: null };
    const mix = fadeProgress(fade.start, fade.ms, now);
    const fromTexture = this.pool.texture(fade.from.item.key);
    if (mix >= 1 || !fromTexture) {
      this.fades.delete(frame.id);
      return { source, from: null };
    }
    return { source, from: { source: { texture: fromTexture, fit: 1 }, frame: fade.from.frame, mix } };
  }

  private frameSource(scene: RenderScene, frame: MediaFrame, now: number): FrameSource | null {
    if (frame.testPattern) {
      this.shown.delete(frame.id);
      this.fades.delete(frame.id);
      const label = frame.name || frame.filename || `${Math.round(frame.width)} × ${Math.round(frame.height)}`;
      // Draw at the density it is shown at (output px per unit × zoom), so
      // it stays as crisp as the SVG test card of the CSS renderer
      const density = (this.width / (this.lastCompositionWidth || this.width)) * Math.max(1, frame.contentScale ?? 1);
      return { texture: this.testCard(frame.width, frame.height, label, density), fit: 0 };
    }
    const ms = transitionMs(frame.transition, scene.bpm);
    const held = this.shown.get(frame.id);
    const item = this.frameItem(scene, frame);
    if (!item) {
      // Cleared layer: fades out over its transition, or goes off at once
      if (held && ms > 0) this.fades.set(frame.id, { from: held, start: now, ms });
      this.shown.delete(frame.id);
      return null;
    }
    if (held && held.item.key !== item.key) {
      if (!this.pool.isReady(item.key)) {
        // Hold the last picture until the new clip has a frame
        const texture = this.pool.texture(held.item.key);
        if (texture) return { texture, fit: 1 };
      } else if (ms > 0) {
        // The new clip is there: dissolve from what was on screen
        this.fades.set(frame.id, { from: held, start: now, ms });
      } else {
        this.fades.delete(frame.id);
      }
    }
    const texture = this.pool.texture(item.key);
    if (texture) this.shown.set(frame.id, { item, frame });
    return texture ? { texture, fit: 1 } : null;
  }

  private testCard(width: number, height: number, label: string, density: number): MediaTexture {
    // Density in steps of ¼ so small changes don't redraw the card
    const step = Math.max(0.25, Math.ceil(density * 4) / 4);
    const key = `${Math.round(width)}x${Math.round(height)}@${step}:${label}`;
    const cached = this.testCards.get(key);
    if (cached) return cached;
    const gl = this.gl;
    const canvas = drawTestCard(width, height, label, step);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const card = { texture, width: canvas.width, height: canvas.height };
    // Keep a bounded cache (labels/sizes change while editing)
    if (this.testCards.size > 32) {
      const [oldestKey, oldest] = this.testCards.entries().next().value!;
      gl.deleteTexture(oldest.texture);
      this.testCards.delete(oldestKey);
    }
    this.testCards.set(key, card);
    return card;
  }

  private copy(source: WebGLTexture, gain: number) {
    const gl = this.gl;
    const p = this.copyProgram;
    gl.useProgram(p.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(this.uniform(p, 'u_source'), 0);
    gl.uniform1f(this.uniform(p, 'u_gain'), gain);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawBackground(scene: RenderScene) {
    const gl = this.gl;
    const p = this.backgroundProgram;
    const bg = scene.background;
    const media = bg.type !== 'color' && bg.url ? this.pool.texture(BACKGROUND_KEY) : null;
    gl.useProgram(p.program);
    gl.uniform2f(this.uniform(p, 'u_targetSize'), this.width, this.height);
    // Media backgrounds sit on black (like the DOM stage) until loaded
    gl.uniform4fv(this.uniform(p, 'u_color'), bg.type === 'color' ? hexToRgba(bg.color) : [0, 0, 0, 1]);
    gl.uniform1i(this.uniform(p, 'u_hasMedia'), media ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, media?.texture ?? null);
    if (media) {
      gl.uniform1i(this.uniform(p, 'u_media'), 0);
      gl.uniform1f(this.uniform(p, 'u_mediaAspect'), media.width / media.height);
      gl.uniform1f(this.uniform(p, 'u_stageAspect'), scene.composition.width / scene.composition.height);
    }
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // A clip's content transform and look (struct Look in the shader)
  private setLook(name: string, frame: MediaFrame, source: FrameSource | null) {
    const gl = this.gl;
    const u = (field: string) => this.uniform(this.frameProgram, `${name}.${field}`);
    const params = frameRenderParams(frame);
    gl.uniform2f(u('flip'), params.flip.x, params.flip.y);
    gl.uniform1f(u('zoom'), params.zoom);
    gl.uniform2f(u('offset'), params.offset.x, params.offset.y);
    gl.uniform1i(u('fit'), source?.fit ?? 1);
    gl.uniform1f(u('mediaAspect'), source ? source.texture.width / source.texture.height : 1);
    gl.uniform1f(u('blur'), frame.blur);
    gl.uniform1f(u('brightness'), frame.brightness / 100);
    gl.uniform1f(u('contrast'), frame.contrast / 100);
    gl.uniform1f(u('grayscale'), Math.min(1, frame.grayscale / 100));
    gl.uniform1f(u('saturate'), frame.saturate / 100);
    gl.uniform1f(u('hueRotate'), (frame.hueRotate * Math.PI) / 180);
    gl.uniform1f(u('invert'), Math.min(1, frame.invert / 100));
    gl.uniform1f(u('sepia'), Math.min(1, frame.sepia / 100));
  }

  private drawFrame(
    scene: RenderScene,
    frame: MediaFrame,
    { source, from }: FrameDraw,
    blendMode: number,
    backdrop: WebGLTexture | null,
  ) {
    const gl = this.gl;
    const p = this.frameProgram;
    const params = frameRenderParams(frame);
    const u = (name: string) => this.uniform(p, name);
    gl.useProgram(p.program);

    // Geometry: the warped box, padded outwards for antialiasing
    const pad = (EDGE_PAD_PX * scene.composition.width) / this.width;
    const cx = params.quad.reduce((s, q) => s + q.x, 0) / 4;
    const cy = params.quad.reduce((s, q) => s + q.y, 0) / 4;
    const padded = params.quad.map((q): Point => {
      const dx = q.x - cx;
      const dy = q.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: q.x + (dx / len) * pad, y: q.y + (dy / len) * pad };
    });
    const [a, b, c, d] = padded;
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([a.x, a.y, b.x, b.y, c.x, c.y, a.x, a.y, c.x, c.y, d.x, d.y]));

    gl.uniform2f(u('u_compSize'), scene.composition.width, scene.composition.height);
    gl.uniform2f(u('u_targetSize'), this.width, this.height);
    gl.uniform2f(u('u_center'), params.center.x, params.center.y);
    gl.uniform2f(u('u_rot'), params.cos, params.sin);
    gl.uniform2f(u('u_size'), params.size.x, params.size.y);
    gl.uniformMatrix3fv(u('u_hinv'), false, params.hinv);
    gl.uniform1i(u('u_shape'), params.shape);
    gl.uniform1i(u('u_vertexCount'), params.vertices.length);
    if (params.vertices.length > 0) {
      const flat = new Float32Array(MAX_POLYGON_VERTICES * 2);
      params.vertices.forEach((v, i) => {
        flat[i * 2] = v.x;
        flat[i * 2 + 1] = v.y;
      });
      gl.uniform2fv(u('u_vertices'), flat);
    }
    gl.uniform4fv(u('u_softEdge'), params.softEdge);

    this.setLook('u_look', frame, source);
    gl.uniform1i(u('u_hasMedia'), source ? 1 : 0);
    // A layer fading out to nothing mixes towards transparent, not the placeholder
    gl.uniform4fv(u('u_fill'), source || from || !scene.showPlaceholders ? [0, 0, 0, 0] : PLACEHOLDER_FILL);
    gl.uniform1f(u('u_opacity'), frame.opacity);
    // Unused samplers are unbound — a render target left on a texture unit
    // would form a feedback loop and the draw would be dropped
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source?.texture.texture ?? null);
    gl.uniform1i(u('u_media'), 0);

    gl.uniform1i(u('u_hasFrom'), from ? 1 : 0);
    gl.uniform1f(u('u_mix'), from?.mix ?? 1);
    if (from) this.setLook('u_fromLook', from.frame, from.source);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, from?.source.texture.texture ?? null);
    gl.uniform1i(u('u_fromMedia'), 2);

    gl.uniform1i(u('u_blendMode'), blendMode);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, backdrop);
    gl.uniform1i(u('u_backdrop'), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
