import type { LiveState } from '../../state/liveStore';

// ---------------------------------------------------------------------------
// Media elements + textures for the GPU compositor. One element per frame
// (like the DOM renderer: each frame has its own playback rate, loop, mute
// and position), kept off-DOM. Video textures are only re-uploaded when the
// video presents a new frame (requestVideoFrameCallback).
// ---------------------------------------------------------------------------

export interface MediaItem {
  key: string;
  url: string;
  type: 'video' | 'image';
  loop: boolean;
  muted: boolean;
  playbackRate: number;
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
}

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
    const keep = new Set(items.map(i => i.key));
    for (const [key, entry] of this.entries) {
      if (!keep.has(key) || entry.item.url !== items.find(i => i.key === key)?.url ||
          entry.item.type !== items.find(i => i.key === key)?.type) {
        this.remove(key);
      }
    }
    for (const item of items) {
      const entry = this.entries.get(item.key) ?? this.create(item);
      entry.item = item;
      if (entry.element instanceof HTMLVideoElement) {
        const video = entry.element;
        video.loop = item.loop;
        if (video.playbackRate !== item.playbackRate) video.playbackRate = item.playbackRate;
        video.volume = Math.max(0, Math.min(1, gain));
        // Unmute only once playback runs (autoplay needs muted start)
        if (!video.paused && video.muted !== item.muted) video.muted = item.muted;
      }
    }

    // Transport: only commands sent after the pool started apply
    if (this.lastPlaybackSeq === null) this.lastPlaybackSeq = playback.seq;
    if (playback.seq !== this.lastPlaybackSeq) {
      this.lastPlaybackSeq = playback.seq;
      for (const entry of this.entries.values()) {
        if (!(entry.element instanceof HTMLVideoElement)) continue;
        if (playback.command === 'play') this.play(entry.element, entry.item.muted);
        else if (playback.command === 'pause') entry.element.pause();
      }
    }
  }

  private create(item: MediaItem): Entry {
    const entry: Entry = { item, element: null!, texture: null, width: 0, height: 0, dirty: false, failed: false };
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
        this.play(video, entry.item.muted);
      });
      if (supportsFrameCallback(video)) {
        const onFrame = () => {
          if (!this.entries.has(item.key) || this.entries.get(item.key) !== entry) return;
          entry.dirty = true;
          this.hasNewFrames = true;
          video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
      }
      entry.element = video;
    } else {
      const image = new Image();
      if (isRemote(item.url)) image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        entry.dirty = true;
        this.hasNewFrames = true;
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
    const result = this.hasNewFrames;
    this.hasNewFrames = false;
    // Without rVFC, playing videos are uploaded every frame
    for (const entry of this.entries.values()) {
      if (entry.element instanceof HTMLVideoElement && !supportsFrameCallback(entry.element) && !entry.element.paused) {
        entry.dirty = true;
        return true;
      }
    }
    return result;
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
