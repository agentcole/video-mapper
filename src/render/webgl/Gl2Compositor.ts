import type { EffectInstance, MediaFrame, Point, Screen } from '../../types';
import type { RenderScene, SceneRenderer } from '../types';
import { frameRenderParams, MAX_POLYGON_VERTICES, toMat3 } from '../frameMath';
import { isValidQuad, screenToSlice, sliceZoom } from '../../state/screens';
import { crossfadeGain, fadeProgress, transitionMs } from '../../state/transitions';
import { beatAt, clockNow } from '../../state/clock';
import { hasMods, modulate, modulatedParams, seedOf, type ModContext } from '../../state/modulation';
import { currentAudio } from '../../audio/audioBus';
import { effectKey, getEffectDef, reportCompileError, requestUnknownEffect } from '../../effects/library';
import { EffectRunner, type ResolvedEffect } from './EffectRunner';
import { drawTestCard } from '../testCardCanvas';
import { MediaPool, type MediaItem, type MediaTexture } from './MediaPool';
import {
  QUAD_VERTEX, FULLSCREEN_VERTEX, COPY_FRAGMENT, BACKGROUND_FRAGMENT, FRAME_FRAGMENT, BLEND_MODE_CODES,
  SLICE_VERTEX, SLICE_FRAGMENT,
} from './shaders';

// ---------------------------------------------------------------------------
// WebGL2 compositor: background + frames into an offscreen target, then the
// master fader on the way to the canvas. Normal-blended frames use GPU
// blending; other blend modes read the layers below from a ping-pong copy.
// For a screen (3.1) the composition is rendered at its own resolution and
// the canvas shows the screen: each slice samples its input rectangle and
// lands on its four output corners.
// ---------------------------------------------------------------------------

const BACKGROUND_KEY = '__background__';
// Effects and generators render at most this big (longest side, px)
const EFFECT_MAX_SIZE = 2048;
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
  yUp?: boolean; // rendered here (effects, generators): bottom row first
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
  private sliceProgram!: Program;
  private quadBuffer!: WebGLBuffer;
  private quadVao!: WebGLVertexArrayObject;
  private sliceBuffer!: WebGLBuffer;
  private sliceVao!: WebGLVertexArrayObject;
  private maxTextureSize = 4096;
  private emptyVao!: WebGLVertexArrayObject;
  private targets: Target[] = [];
  private pool: MediaPool;
  private testCards = new Map<string, MediaTexture>();
  private lost = false;
  // The composition picture (render targets) …
  private width = 1;
  private height = 1;
  // … and the canvas. The same size, unless a screen is drawn.
  private canvasWidth = 1;
  private canvasHeight = 1;
  private lastScene: RenderScene | null = null;
  private lastCompositionWidth = 0;
  // Per frame, the media last drawn: after a trigger it stays on screen
  // (and playing) until the new clip has a frame to show — no black gap —
  // then dissolves into it over the frame's transition
  private shown = new Map<string, Shown>();
  private fades = new Map<string, Fade>();
  private effects!: EffectRunner;
  // Content resolved this render (effect stacks, generators), by clip
  private sources = new Map<string, FrameSource | null>();
  private frameIndex = 0;
  private lastEffectTime = 0;
  // Modulation sources this render (clock, audio, macros)
  private mod: ModContext = { now: 0, clock: { bpm: 120, origin: 0 }, audio: null, macros: [] };

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
    this.sliceProgram = this.createProgram(SLICE_VERTEX, SLICE_FRAGMENT);
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

    this.quadBuffer = gl.createBuffer()!;
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 12 * 4, gl.DYNAMIC_DRAW);
    const location = gl.getAttribLocation(this.frameProgram.program, 'a_position');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.sliceBuffer = gl.createBuffer()!;
    this.sliceVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.sliceVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sliceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 12 * 4, gl.DYNAMIC_DRAW);
    const sliceLocation = gl.getAttribLocation(this.sliceProgram.program, 'a_position');
    gl.enableVertexAttribArray(sliceLocation);
    gl.vertexAttribPointer(sliceLocation, 2, gl.FLOAT, false, 0, 0);
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    this.targets = [];
    this.testCards.clear();
    this.createTargets();
    this.effects = new EffectRunner(gl, reportCompileError);
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
    const w = Math.max(1, Math.min(this.maxTextureSize, Math.round(width)));
    const h = Math.max(1, Math.min(this.maxTextureSize, Math.round(height)));
    if (w === this.canvasWidth && h === this.canvasHeight) return;
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.lastScene = null;
  }

  /**
   * Size of the composition picture: the canvas — or, for a screen, the
   * composition at the density its slices show it (at most its own
   * resolution), in steps of a quarter so dragging a corner doesn't
   * reallocate the targets on every move.
   */
  private targetSize(scene: RenderScene): { width: number; height: number } {
    const screen = scene.screen;
    if (!screen) return { width: this.canvasWidth, height: this.canvasHeight };
    const { width, height } = scene.composition;
    const canvasScale = Math.max(this.canvasWidth / screen.width, this.canvasHeight / screen.height);
    const zooms = screen.slices.filter(s => s.enabled).map(sliceZoom);
    const needed = canvasScale * (zooms.length > 0 ? Math.max(...zooms) : 1);
    const scale = Math.min(Math.max(0.25, Math.ceil(needed * 4) / 4), 1, this.maxTextureSize / width, this.maxTextureSize / height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  render(scene: RenderScene): void {
    if (this.lost || this.gl.isContextLost()) return;
    const items = this.mediaItems(scene);
    this.pool.update(items.filter(i => !i.generator), scene.outputGain, scene.playback);
    // Skip identical frames: same scene object, no new video frames, no
    // dissolve running and nothing animated by effects or generators
    const newFrames = this.pool.consumeNewFrames();
    const animated = this.isAnimated(scene);
    if (scene === this.lastScene && !newFrames && this.fades.size === 0 && !animated) return;
    this.lastScene = scene;
    this.lastCompositionWidth = scene.composition.width;

    const gl = this.gl;
    const target = this.targetSize(scene);
    if (target.width !== this.width || target.height !== this.height) {
      this.width = target.width;
      this.height = target.height;
      this.createTargets();
    }
    const nowClock = clockNow();
    const time = (nowClock - scene.timeOrigin) / 1000;
    const clock = { bpm: scene.bpm, origin: scene.clockOrigin };
    const audio = currentAudio(nowClock);
    this.mod = { now: nowClock, clock, audio: audio?.levels ?? null, macros: scene.macros };
    this.effects.beginFrame({
      time,
      delta: this.lastEffectTime ? Math.max(0, time - this.lastEffectTime) : 0,
      frame: this.frameIndex++,
      bpm: scene.bpm,
      beat: beatAt(clock, nowClock),
    }, audio);
    this.lastEffectTime = time;
    this.sources.clear();

    // Frames, bottom to top (same order as the DOM stacking). Their content
    // is resolved first: effects render into targets of their own.
    const now = performance.now();
    const draws = scene.frames
      .map((frame, index) => ({ frame, index }))
      .sort((a, b) => a.frame.zIndex - b.frame.zIndex || a.index - b.index)
      .map(({ frame }) => ({ frame, draw: this.frameDraw(scene, frame, now) }));

    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    let current = 0;

    // Background
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[current].framebuffer);
    gl.disable(gl.BLEND);
    this.drawBackground(scene);

    for (const { frame, draw } of draws) {
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

    // Composition effects on the whole picture
    let picture = this.targets[current].texture;
    const composition = this.resolveEffects(scene.effects);
    if (composition.length > 0) {
      const size = { width: this.width, height: this.height };
      const result = this.effects.run('composition', { texture: picture, ...size, yUp: true }, composition, size);
      if (result) picture = result.texture;
    }

    // Present with the master fader: the composition, or the screen's slices of it
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    if (scene.screen) {
      this.drawScreen(scene, scene.screen, picture);
    } else {
      gl.disable(gl.BLEND);
      this.copy(picture, scene.masterOpacity);
    }
    this.effects.endFrame();
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.pool.dispose();
    this.effects.dispose();
    const gl = this.gl;
    for (const card of this.testCards.values()) gl.deleteTexture(card.texture);
    for (const target of this.targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    // Free the GPU context once the canvas is gone. A canvas that stays
    // (React StrictMode mounts the stage twice) keeps its context for the
    // next compositor — a lost one would never come back.
    const lose = gl.getExtension('WEBGL_lose_context');
    const canvas = this.canvas;
    setTimeout(() => {
      if (!canvas.isConnected) lose?.loseContext();
    }, 0);
  }

  // ---- Drawing -------------------------------------------------------------------

  // The media a frame plays: its layer's clip (shared by the layer's surfaces)
  private frameItem(scene: RenderScene, frame: MediaFrame): MediaItem | null {
    if (frame.testPattern) return null;
    if (frame.generator) {
      return {
        key: `gen:${frame.clipId ?? frame.id}`, url: `isf:${frame.generator.effectId}`, type: 'image', loop: true,
        muted: true, playbackRate: 1, active: true, startSeq: 0, layerId: frame.layerId, generator: frame.generator,
      };
    }
    if (!frame.url) return null;
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
    const { source, owner } = this.frameSource(scene, frame, now);
    const shown = this.withEffects(source, owner);
    const fade = this.fades.get(frame.id);
    if (!fade) return { source: shown, from: null };
    const mix = fadeProgress(fade.start, fade.ms, now);
    const fromSource = this.withEffects(this.contentOf(scene, fade.from.item), fade.from.frame);
    if (mix >= 1 || !fromSource) {
      this.fades.delete(frame.id);
      return { source: shown, from: null };
    }
    return { source: shown, from: { source: fromSource, frame: fade.from.frame, mix } };
  }

  /** The frame's content, and the frame whose effects apply to it (the held clip's while it holds). */
  private frameSource(scene: RenderScene, frame: MediaFrame, now: number): { source: FrameSource | null; owner: MediaFrame } {
    if (frame.testPattern) {
      this.shown.delete(frame.id);
      this.fades.delete(frame.id);
      const label = frame.name || frame.filename || `${Math.round(frame.width)} × ${Math.round(frame.height)}`;
      // Draw at the density it is shown at (output px per unit × zoom), so
      // it stays as crisp as the SVG test card of the CSS renderer
      const density = (this.width / (this.lastCompositionWidth || this.width)) * Math.max(1, frame.contentScale ?? 1);
      return { source: { texture: this.testCard(frame.width, frame.height, label, density), fit: 0 }, owner: frame };
    }
    const ms = transitionMs(frame.transition, scene.bpm);
    const held = this.shown.get(frame.id);
    const item = this.frameItem(scene, frame);
    if (!item) {
      // Cleared layer: fades out over its transition, or goes off at once
      if (held && ms > 0) this.fades.set(frame.id, { from: held, start: now, ms });
      this.shown.delete(frame.id);
      return { source: null, owner: frame };
    }
    if (held && held.item.key !== item.key) {
      if (!this.isReady(item)) {
        // Hold the last picture until the new clip has a frame
        const source = this.contentOf(scene, held.item);
        if (source) return { source, owner: held.frame };
      } else if (ms > 0) {
        // The new clip is there: dissolve from what was on screen
        this.fades.set(frame.id, { from: held, start: now, ms });
      } else {
        this.fades.delete(frame.id);
      }
    }
    const source = this.contentOf(scene, item);
    if (source) this.shown.set(frame.id, { item, frame });
    return { source, owner: frame };
  }

  private isReady(item: MediaItem): boolean {
    return item.generator ? true : this.pool.isReady(item.key);
  }

  /** What a media item shows now: a video/image texture, or a generator's picture. */
  private contentOf(scene: RenderScene, item: MediaItem): FrameSource | null {
    if (!item.generator) {
      const texture = this.pool.texture(item.key);
      return texture ? { texture, fit: 1 } : null;
    }
    const cacheKey = `gen|${item.key}`;
    if (this.sources.has(cacheKey)) return this.sources.get(cacheKey)!;
    let source: FrameSource | null = null;
    const def = getEffectDef(item.generator.effectId);
    if (!def) {
      requestUnknownEffect();
    } else if (def.shader && def.kind === 'generator') {
      // Generators fill the composition; surfaces show their part like media
      const scale = Math.min(1, EFFECT_MAX_SIZE / Math.max(scene.composition.width, scene.composition.height));
      const size = {
        width: Math.max(1, Math.round(scene.composition.width * scale)),
        height: Math.max(1, Math.round(scene.composition.height * scale)),
      };
      const generator: ResolvedEffect = {
        instance: {
          id: 'generator',
          enabled: true,
          params: modulatedParams(def.shader.inputs, item.generator.params, item.generator.mods, this.mod, item.key),
        },
        shader: def.shader,
        key: effectKey(def),
      };
      const result = this.effects.run(item.key, null, [generator], size);
      if (result) source = { texture: result, fit: 1, yUp: true };
    }
    this.sources.set(cacheKey, source);
    return source;
  }

  /** A frame's content through its clip's and layer's effect stacks. */
  private withEffects(source: FrameSource | null, frame: MediaFrame): FrameSource | null {
    if (!source || frame.testPattern) return source;
    const stack = this.resolveEffects([...(frame.clipEffects ?? []), ...(frame.layerEffects ?? [])]);
    if (stack.length === 0) return source;
    const cacheKey = `fx|${frame.clipId ?? frame.id}`;
    if (this.sources.has(cacheKey)) return this.sources.get(cacheKey)!;
    const { width, height } = source.texture;
    const scale = Math.min(1, EFFECT_MAX_SIZE / Math.max(width, height));
    const size = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    const result = this.effects.run(cacheKey, { ...source.texture, yUp: !!source.yUp }, stack, size);
    const processed: FrameSource = result ? { texture: result, fit: source.fit, yUp: result.yUp } : source;
    this.sources.set(cacheKey, processed);
    return processed;
  }

  private resolveEffects(instances: EffectInstance[] | undefined): ResolvedEffect[] {
    const resolved: ResolvedEffect[] = [];
    for (const instance of instances ?? []) {
      if (!instance.enabled) continue;
      const def = getEffectDef(instance.effectId);
      if (!def) {
        requestUnknownEffect();
        continue;
      }
      if (def.shader && def.kind === 'effect') {
        const params = modulatedParams(def.shader.inputs, instance.params, instance.mods, this.mod, instance.id);
        resolved.push({ instance: params === instance.params ? instance : { ...instance, params }, shader: def.shader, key: effectKey(def) });
      }
    }
    return resolved;
  }

  /** A frame's opacity now: its layer's (modulated), through the crossfader. */
  private opacityOf(scene: RenderScene, frame: MediaFrame): number {
    const mod = frame.layerMods?.opacity;
    const base = mod ? modulate(frame.opacity, mod, 0, 1, this.mod, seedOf(`${frame.layerId}|opacity`)) : frame.opacity;
    return base * crossfadeGain(frame.crossfade, scene.crossfader);
  }

  // Animated content needs a redraw every frame
  private isAnimated(scene: RenderScene): boolean {
    const active = (list?: EffectInstance[]) => !!list?.some(e => e.enabled);
    return active(scene.effects) ||
      scene.frames.some(f => f.generator || active(f.clipEffects) || active(f.layerEffects) || hasMods(f.layerMods));
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

  /** The screen on the canvas: black, then every enabled slice (later ones on top). */
  private drawScreen(scene: RenderScene, screen: Screen, picture: WebGLTexture) {
    const gl = this.gl;
    const p = this.sliceProgram;
    const u = (name: string) => this.uniform(p, name);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.program);
    gl.uniform2f(u('u_screenSize'), screen.width, screen.height);
    gl.uniform1f(u('u_gain'), scene.masterOpacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, picture);
    gl.uniform1i(u('u_picture'), 0);
    gl.bindVertexArray(this.sliceVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sliceBuffer);
    const { width: compW, height: compH } = scene.composition;
    // Grow the quad a little so antialiased edges aren't cut off
    const pad = (EDGE_PAD_PX * screen.width) / this.canvasWidth;
    for (const slice of screen.slices) {
      if (!slice.enabled || !isValidQuad(slice.output)) continue;
      const hinv = screenToSlice(slice);
      if (!hinv) continue;
      const cx = slice.output.reduce((sum, q) => sum + q.x, 0) / 4;
      const cy = slice.output.reduce((sum, q) => sum + q.y, 0) / 4;
      const [a, b, c, d] = slice.output.map((q): Point => {
        const len = Math.hypot(q.x - cx, q.y - cy) || 1;
        return { x: q.x + ((q.x - cx) / len) * pad, y: q.y + ((q.y - cy) / len) * pad };
      });
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([a.x, a.y, b.x, b.y, c.x, c.y, a.x, a.y, c.x, c.y, d.x, d.y]));
      gl.uniformMatrix3fv(u('u_hinv'), false, toMat3(hinv));
      const { x, y, width, height } = slice.input;
      gl.uniform4f(u('u_input'), x / compW, y / compH, width / compW, height / compH);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
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
    gl.uniform1i(u('yUp'), source?.yUp ? 1 : 0);
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
    gl.uniform1f(u('u_opacity'), this.opacityOf(scene, frame));
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
