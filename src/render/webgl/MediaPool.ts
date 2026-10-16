import type { LiveState } from '../../state/liveStore';
import { reportFirstFrame } from '../startStats';

// ---------------------------------------------------------------------------
// Media elements + textures for the GPU compositor, kept off-DOM. One element
// per playing clip (surfaces of one layer share it, so they stay in sync).
// Preloaded clips are loaded and parked on their first frame, so a trigger
// only has to call play(). Video textures are only re-uploaded when the video
// presents a new frame (requestVideoFrameCallback).
// ---------------------------------------------------------------------------

export interface MediaItem {
  key: string;
  url: string;
  type: 'video' | 'image';
  loop: boolean;
  muted: boolean;
  playbackRate: number;
  active: boolean; // playing; false = preloaded and parked at the start
  startSeq: number; // a change restarts an active clip from the top
  layerId?: string; // for start latency stats
}

export interface MediaTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface Entry {
  item: MediaItem;
  element: HTMLVideoElement | HTMLImageElement;
  texture: WebGLTexture | null;
  width: number;
  height: number;
  dirty: boolean; // a new frame/image is waiting to be uploaded
  failed: boolean;
  active: boolean;
  startSeq: number;
  // Started by a trigger and waiting for its first frame (latency stats)
  awaitingFirstFrame: boolean;
  startedPreloaded: boolean;
  // Until this time, upload every animation frame instead of waiting for
  // requestVideoFrameCallback: Chrome only presents frames of a video that
  // isn't composited after a 250 ms background-render timeout, while a
  // texture upload pulls the current frame right away
  warmUntil: number;
}

const WARM_UP_MS = 1000;

const isRemote = (url: string) => /^https?:/i.test(url) && !url.startsWith(window.location.origin);

const supportsFrameCallback = (video: HTMLVideoElement): boolean =>
  typeof (video as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function';


export class MediaPool {
  private entries = new Map<string, Entry>();
  private lastPlaybackSeq: number | null = null;
  private warned = new Set<string>();
  private hasNewFrames = false;
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /** Sync elements with the scene: create, update and remove. */
  update(items: MediaItem[], gain: number, playback: LiveState['playback']): void {
    const byKey = new Map(items.map(i => [i.key, i]));
    for (const [key, entry] of this.entries) {
      const item = byKey.get(key);
      if (!item || entry.item.url !== item.url || entry.item.type !== item.type) this.remove(key);
    }

    // Transport (play/pause all): only commands sent after the pool started
    // apply, and only to playing clips — preloads stay parked. A triggered
    // clip always plays, like a new frame in the CSS renderer.
    if (this.lastPlaybackSeq === null) this.lastPlaybackSeq = playback.seq;
    const command = playback.seq !== this.lastPlaybackSeq ? playback.command : null;
    this.lastPlaybackSeq = playback.seq;

    for (const item of byKey.values()) {
      const existing = this.entries.get(item.key);
      const entry = existing ?? this.create(item);
      entry.item = item;
      if (!(entry.element instanceof HTMLVideoElement)) {
        entry.active = item.active;
        continue;
      }
      const video = entry.element;
      video.loop = item.loop;
      if (video.playbackRate !== item.playbackRate) video.playbackRate = item.playbackRate;
      video.volume = Math.max(0, Math.min(1, gain));

      if (existing && item.active && (!entry.active || entry.startSeq !== item.startSeq)) {
        // Triggered: start from the top (a preloaded clip is parked there)
        entry.startedPreloaded = video.readyState >= 2;
        entry.awaitingFirstFrame = true;
        entry.warmUntil = performance.now() + WARM_UP_MS;
        if (video.currentTime > 0) video.currentTime = 0;
        this.play(video, item.muted);
      } else if (existing && !item.active && entry.active) {
        // No longer playing but still preloaded: park it at the start again
        video.pause();
        video.muted = true;
        if (video.currentTime > 0) video.currentTime = 0;
      } else if (item.active) {
        // Unmute only once playback runs (autoplay needs a muted start)
        if (!video.paused && video.muted !== item.muted) video.muted = item.muted;
        if (command === 'play') this.play(video, item.muted);
        else if (command === 'pause') video.pause();
      }
      entry.active = item.active;
      entry.startSeq = item.startSeq;
    }
  }

  private create(item: MediaItem): Entry {
    const entry: Entry = {
      item, element: null!, texture: null, width: 0, height: 0, dirty: false, failed: false,
      active: item.active, startSeq: item.startSeq,
      awaitingFirstFrame: item.active, startedPreloaded: false,
      warmUntil: item.active ? performance.now() + WARM_UP_MS : 0,
    };
    const onError = () => {
      entry.failed = true;
      if (!this.warned.has(item.url)) {
        this.warned.add(item.url);
        console.warn(
          `GPU renderer can't use ${item.url}` +
          (isRemote(item.url) ? ' — remote media needs CORS headers to be drawn on the GPU' : ''),
        );
      }
    };
    const firstFrame = (at?: number) => {
      if (!entry.awaitingFirstFrame || !entry.active) return;
      entry.awaitingFirstFrame = false;
      reportFirstFrame(entry.item.layerId, entry.startedPreloaded, at);
    };

    if (item.type === 'video') {
      const video = document.createElement('video');
      if (isRemote(item.url)) video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.loop = item.loop;
      video.preload = 'auto';
      video.src = item.url;
      video.addEventListener('error', onError);
      video.addEventListener('loadeddata', () => {
        entry.dirty = true;
        this.hasNewFrames = true;
        if (entry.active) this.play(video, entry.item.muted);
      });
      if (supportsFrameCallback(video)) {
        const onFrame = (now: number) => {
          if (this.entries.get(item.key) !== entry) return;
          entry.dirty = true;
          this.hasNewFrames = true;
          if (!video.paused) {
            firstFrame(now);
            entry.warmUntil = 0; // frames are flowing: back to rVFC-driven uploads
          }
          video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
      } else {
        video.addEventListener('playing', () => firstFrame());
      }
      entry.element = video;
    } else {
      const image = new Image();
      if (isRemote(item.url)) image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        entry.dirty = true;
        this.hasNewFrames = true;
        firstFrame();
      };
      image.onerror = onError;
      image.src = item.url;
      entry.element = image;
    }
    this.entries.set(item.key, entry);
    return entry;
  }

  private play(video: HTMLVideoElement, muted: boolean) {
    video.muted = true; // autoplay policy: start muted, then restore
    video.play()
      .then(() => {
        video.muted = muted;
      })
      .catch(() => {
        // Not allowed yet (no user gesture) — stays muted and retries on the next command
      });
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.element instanceof HTMLVideoElement) {
      entry.element.pause();
      entry.element.removeAttribute('src');
      entry.element.load();
    }
    if (entry.texture) this.gl.deleteTexture(entry.texture);
    this.entries.delete(key);
  }

  /** Whether any media presented a new frame since the last call. */
  consumeNewFrames(): boolean {
    let result = this.hasNewFrames;
    this.hasNewFrames = false;
    // Without rVFC — or while a started clip warms up — playing videos are
    // uploaded every frame
    const now = performance.now();
    for (const entry of this.entries.values()) {
      const video = entry.element;
      if (!(video instanceof HTMLVideoElement) || video.paused) continue;
      if (!supportsFrameCallback(video) || entry.warmUntil > now) {
        entry.dirty = true;
        result = true;
      }
    }
    return result;
  }

  /** Whether the media for a key can be drawn now (loaded, not mid-seek). */
  isReady(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.failed) return false;
    const element = entry.element;
    return element instanceof HTMLVideoElement
      ? element.readyState >= 2 && !element.seeking
      : element.complete && element.naturalWidth > 0;
  }

  /** The texture for a key, uploading a pending frame first. */
  texture(key: string): MediaTexture | null {
    const entry = this.entries.get(key);
    if (!entry || entry.failed) return null;
    const gl = this.gl;
    const element = entry.element;
    const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
    const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
    const ready = element instanceof HTMLVideoElement ? element.readyState >= 2 : element.complete && width > 0;

    if (entry.dirty && ready && width > 0 && height > 0) {
      entry.dirty = false;
      try {
        if (!entry.texture) {
          entry.texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, entry.texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (entry.width !== width || entry.height !== height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
          entry.width = width;
          entry.height = height;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, element);
        }
        // A started clip is on screen and moving
        if (entry.awaitingFirstFrame && entry.active && element instanceof HTMLVideoElement &&
            !element.paused && element.currentTime > 0) {
          entry.awaitingFirstFrame = false;
          reportFirstFrame(entry.item.layerId, entry.startedPreloaded);
        }
      } catch (error) {
        // Tainted (cross-origin without CORS) or decode problem
        entry.failed = true;
        if (!this.warned.has(entry.item.url)) {
          this.warned.add(entry.item.url);
          console.warn(`GPU renderer can't upload ${entry.item.url}:`, error);
        }
        return null;
      }
    }
    return entry.texture ? { texture: entry.texture, width: entry.width, height: entry.height } : null;
  }

  /** After a context loss every texture is gone: recreate on next use. */
  resetTextures(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    for (const entry of this.entries.values()) {
      entry.texture = null;
      entry.width = 0;
      entry.height = 0;
      entry.dirty = true;
    }
    this.hasNewFrames = true;
  }

  dispose(): void {
    for (const key of [...this.entries.keys()]) this.remove(key);
  }
}
