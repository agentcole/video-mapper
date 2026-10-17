import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { MediaFrame, MediaType, Point } from '../types';
import type { LiveState } from '../state/liveStore';
import type { PreloadMedia } from '../render/types';
import { reportFirstFrame } from '../render/startStats';
import { TestCard } from './TestCard';
import { applyHomography, getFrameHomography, getShapeVertices, homographyToCSS } from '../lib/geometry';

// Helper to convert normalized vertices to clip-path polygon string (percent)
const verticesToClipPath = (vertices: Point[] | undefined): string => {
  if (!vertices || vertices.length < 3) return 'none';
  const points = vertices.map(v => `${v.x * 100}% ${v.y * 100}%`).join(', ');
  return `polygon(${points})`;
};

// ---- Media elements --------------------------------------------------------------

// shown: on screen. pending: a triggered clip loading behind the shown one.
// preload: loaded and parked on its first frame, invisible, until triggered.
type MediaRole = 'shown' | 'pending' | 'preload';

interface MediaDesc {
  key: string; // clip + url: the same element survives preload → pending → shown
  url: string;
  type: MediaType;
  loop: boolean;
  muted: boolean;
  playbackRate: number;
}

const playMuted = (video: HTMLVideoElement, muted: boolean) => {
  video.muted = true; // autoplay policy: start muted, then restore
  video.play()
    .then(() => {
      video.muted = muted;
    })
    .catch(error => console.warn('Autoplay failed, will play on user interaction:', error));
};

const supportsFrameCallback = (video: HTMLVideoElement): boolean =>
  typeof (video as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function';

interface MediaElementProps {
  media: MediaDesc;
  role: MediaRole;
  startSeq?: number; // layer trigger counter: a change restarts the clip (undefined: never)
  layerId?: string;
  playback: LiveState['playback'];
  outputGain: number;
  style: React.CSSProperties;
  onReady?: () => void; // pending media has a frame to show
}

const MediaElement: React.FC<MediaElementProps> = ({
  media, role, startSeq, layerId, playback, outputGain, style, onReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const active = role !== 'preload';
  const stateRef = useRef({ role, seq: startSeq });
  // Started by a trigger and waiting for its first frame (latency stats)
  const startRef = useRef({ awaiting: active, preloaded: false });

  // Playback settings
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = media.playbackRate;
    video.volume = Math.max(0, Math.min(1, outputGain));
    if (active && !video.paused) video.muted = media.muted;
  }, [media.playbackRate, media.muted, outputGain, active]);

  // Autoplay once loaded (playing roles only; preloads stay parked)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    const start = () => playMuted(video, media.muted);
    if (video.readyState >= 2) {
      if (video.paused) start();
      return;
    }
    video.addEventListener('loadeddata', start, { once: true });
    return () => video.removeEventListener('loadeddata', start);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- (re)start on load and role changes only
  }, [media.url, active]);

  // Role changes and retriggers
  useEffect(() => {
    const video = videoRef.current;
    const prev = stateRef.current;
    stateRef.current = { role, seq: startSeq ?? prev.seq };
    if (!video) return;
    const wasActive = prev.role !== 'preload';
    if (!active) {
      if (wasActive) {
        video.pause();
        if (video.currentTime > 0) video.currentTime = 0;
      }
      return;
    }
    const retriggered = startSeq !== undefined && prev.seq !== undefined && startSeq !== prev.seq;
    if (!wasActive || retriggered) {
      startRef.current = { awaiting: true, preloaded: video.readyState >= 2 };
      if (video.currentTime > 0) video.currentTime = 0;
      playMuted(video, media.muted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to role / trigger changes only
  }, [role, startSeq]);

  // Report the first frame after a (re)start
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const report = (at?: number) => {
      if (!startRef.current.awaiting || stateRef.current.role === 'preload') return;
      startRef.current.awaiting = false;
      reportFirstFrame(layerId, startRef.current.preloaded, at);
    };
    if (supportsFrameCallback(video)) {
      const onFrame = (now: number) => {
        if (cancelled) return;
        if (!video.paused) report(now);
        video.requestVideoFrameCallback(onFrame);
      };
      const handle = video.requestVideoFrameCallback(onFrame);
      return () => {
        cancelled = true;
        video.cancelVideoFrameCallback(handle);
      };
    }
    const onPlaying = () => report();
    video.addEventListener('playing', onPlaying);
    return () => video.removeEventListener('playing', onPlaying);
  }, [layerId]);

  // Pending media hands over as soon as it has a frame
  useEffect(() => {
    if (role !== 'pending' || !onReady) return;
    const video = videoRef.current;
    const image = imageRef.current;
    if (video) {
      if (video.readyState >= 2 && !video.seeking) {
        onReady();
        return;
      }
      video.addEventListener('loadeddata', onReady, { once: true });
      return () => video.removeEventListener('loadeddata', onReady);
    }
    if (image) {
      if (image.complete && image.naturalWidth > 0) {
        onReady();
        return;
      }
      image.addEventListener('load', onReady, { once: true });
      return () => image.removeEventListener('load', onReady);
    }
  }, [role, onReady]);

  // Play all / pause all: only commands sent after mounting, only playing media
  const lastPlaybackSeqRef = useRef(playback.seq);
  useEffect(() => {
    if (playback.seq === lastPlaybackSeqRef.current) return;
    lastPlaybackSeqRef.current = playback.seq;
    const video = videoRef.current;
    if (!video || !active || !playback.command) return;
    if (playback.command === 'play') playMuted(video, media.muted);
    else video.pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- commands are events
  }, [playback]);

  const elementStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...style,
    ...(role === 'shown' ? {} : { opacity: 0, pointerEvents: 'none' }),
  };

  return media.type === 'video' ? (
    <video
      ref={videoRef}
      src={media.url}
      loop={media.loop}
      muted // Always muted for initial autoplay (browser requirement)
      autoPlay={active}
      preload="auto"
      playsInline
      style={elementStyle}
    />
  ) : (
    <img
      ref={imageRef}
      src={media.url}
      alt=""
      style={elementStyle}
      draggable={false}
    />
  );
};

interface FrameContentProps {
  frame: MediaFrame;
  url?: string; // media URL override (the output window resolves its own)
  playback: LiveState['playback']; // Global transport (play / pause all)
  outputGain: number; // master fader × blackout, applied to audio volume
  showPlaceholder: boolean; // editor only: "add media" on empty frames
  preload?: PreloadMedia[]; // clips of this frame's layer to keep ready
  startSeq?: number; // this frame's layer trigger counter
}

const NO_PRELOAD: PreloadMedia[] = [];

// The visual output of one frame: media through the shape clip and the
// corner-pin homography, blended into the stage. No editor UI and no
// interaction — shared by the editor and the output window.
export const FrameContent = React.memo(function FrameContent({
  frame,
  url = frame.url,
  playback,
  outputGain,
  showPlaceholder,
  preload = NO_PRELOAD,
  startSeq,
}: FrameContentProps) {
  // What this frame plays now
  const current: MediaDesc | null = url && !frame.testPattern
    ? {
        key: `${frame.clipId ?? frame.id}|${url}`,
        url,
        type: frame.type,
        loop: frame.loop,
        muted: frame.muted,
        playbackRate: frame.playbackRate,
      }
    : null;

  // After a trigger the previous media stays on screen until the new one has
  // a frame (no black gap); clearing a layer takes effect at once
  const [previous, setPrevious] = useState<MediaDesc | null>(current);
  const [held, setHeld] = useState<MediaDesc | null>(null);
  if (current?.key !== previous?.key) {
    setPrevious(current);
    const keep = current && previous ? held ?? previous : null;
    setHeld(keep && keep.key !== current?.key ? keep : null);
  }
  const handover = React.useCallback(() => setHeld(null), []);

  const mediaElements: { media: MediaDesc; role: MediaRole; startSeq?: number; onReady?: () => void }[] = [];
  if (!frame.testPattern) {
    if (held) mediaElements.push({ media: held, role: 'shown' });
    if (current) {
      mediaElements.push({ media: current, role: held ? 'pending' : 'shown', startSeq, onReady: held ? handover : undefined });
    }
    // Clips this layer may start next, parked on their first frame
    for (const p of preload) {
      const key = `${p.clipId}|${p.url}`;
      if (key === current?.key || key === held?.key) continue;
      mediaElements.push({
        media: { key, url: p.url, type: p.type, loop: p.loop, muted: p.muted, playbackRate: p.playbackRate },
        role: 'preload',
      });
    }
  }

  // Unified warp model: one homography H per frame (see MediaFrame.tsx)
  const w = frame.width;
  const h = frame.height;
  const H = getFrameHomography(frame);
  const shapeVerticesPx: Point[] = getShapeVertices(frame.shape, frame.vertices, H ? 96 : 48)
    .map(v => (H ? applyHomography(H, v.x * w, v.y * h) : { x: v.x * w, y: v.y * h }));

  // Clip path on the content box (untransformed space)
  const getClipPath = (): string => {
    if (H) {
      // All shapes clip to their homography-transformed outline
      return `polygon(${shapeVerticesPx.map(p => `${p.x}px ${p.y}px`).join(', ')})`;
    }
    if (frame.shape === 'circle') {
      return 'ellipse(50% 50% at 50% 50%)'; // exact ellipse when unwarped
    }
    if (frame.shape === 'polygon') {
      return verticesToClipPath(frame.vertices);
    }
    return 'none';
  };

  const clipPathStyle = getClipPath();

  // Build CSS filter string
  const filterStyle = [
    frame.blur > 0 ? `blur(${frame.blur}px)` : '',
    frame.brightness !== 100 ? `brightness(${frame.brightness}%)` : '',
    frame.contrast !== 100 ? `contrast(${frame.contrast}%)` : '',
    frame.grayscale > 0 ? `grayscale(${frame.grayscale}%)` : '',
    frame.saturate !== 100 ? `saturate(${frame.saturate}%)` : '',
    frame.hueRotate !== 0 ? `hue-rotate(${frame.hueRotate}deg)` : '',
    frame.invert > 0 ? `invert(${frame.invert}%)` : '',
    frame.sepia > 0 ? `sepia(${frame.sepia}%)` : '',
  ].filter(Boolean).join(' ');

  const contentScale = frame.contentScale ?? 1;
  const contentOffsetX = frame.contentOffsetX ?? 0;
  const contentOffsetY = frame.contentOffsetY ?? 0;

  // Content transform. With a homography the transform-origin is (0,0), so
  // flips/zoom are expressed relative to the frame box and composed AFTER the
  // homography (transform lists apply right-to-left).
  const buildContentTransform = (): string => {
    const parts: string[] = [];
    if (H) {
      parts.push(homographyToCSS(H));
      if (frame.flipHorizontal) parts.push(`translate(${w}px, 0px) scaleX(-1)`);
      if (frame.flipVertical) parts.push(`translate(0px, ${h}px) scaleY(-1)`);
      if (contentScale !== 1) parts.push(`translate(${w / 2}px, ${h / 2}px) scale(${contentScale}) translate(${-w / 2}px, ${-h / 2}px)`);
      if (contentOffsetX !== 0 || contentOffsetY !== 0) parts.push(`translate(${contentOffsetX}%, ${contentOffsetY}%)`);
    } else {
      if (frame.flipHorizontal) parts.push('scaleX(-1)');
      if (frame.flipVertical) parts.push('scaleY(-1)');
      if (contentScale !== 1) parts.push(`scale(${contentScale})`);
      if (contentOffsetX !== 0 || contentOffsetY !== 0) parts.push(`translate(${contentOffsetX}%, ${contentOffsetY}%)`);
    }
    return parts.join(' ');
  };

  // Soft edge feathering — masks the content element itself, so the feather
  // warps together with the content under a corner-pin homography.
  const softEdge = frame.softEdge ?? { left: 0, right: 0, top: 0, bottom: 0 };
  const hasSoftEdge = softEdge.left > 0 || softEdge.right > 0 || softEdge.top > 0 || softEdge.bottom > 0;
  const softEdgeMask = hasSoftEdge
    ? [
        `linear-gradient(to right, transparent 0px, black ${softEdge.left}px, black calc(100% - ${softEdge.right}px), transparent 100%)`,
        `linear-gradient(to bottom, transparent 0px, black ${softEdge.top}px, black calc(100% - ${softEdge.bottom}px), transparent 100%)`,
      ].join(', ')
    : undefined;

  const contentStyle: React.CSSProperties = {
    ...(H
      ? {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: '0 0',
        }
      : {}),
    filter: filterStyle || undefined,
    transform: buildContentTransform() || undefined,
    ...(softEdgeMask
      ? {
          maskImage: softEdgeMask,
          maskComposite: 'intersect',
          WebkitMaskImage: softEdgeMask,
          WebkitMaskComposite: 'source-in',
        }
      : {}),
  };

  return (
    <div
      className="absolute"
      style={{
        left: frame.x,
        top: frame.y,
        width: w,
        height: h,
        transform: `rotate(${frame.rotation}deg)`,
        zIndex: frame.zIndex,
        opacity: frame.opacity,
        // This element is the frame's stacking context, so the blend mode has
        // to sit here to mix with the frames and background below it
        mixBlendMode: frame.blendMode,
        pointerEvents: 'none',
        // Warped content may extend beyond the box; the clip-path (which
        // follows the warped shape) does the clipping
        overflow: H ? 'visible' : undefined,
      }}
    >
      <div
        className="w-full h-full relative"
        style={{
          clipPath: clipPathStyle,
          overflow: H ? 'visible' : 'hidden',
          backgroundColor: url || frame.testPattern || !showPlaceholder ? undefined : 'rgb(243 244 246)',
        }}
      >
        {frame.testPattern ? (
          <div className="w-full h-full" style={contentStyle}>
            <TestCard
              width={frame.width}
              height={frame.height}
              label={frame.name || frame.filename || `${Math.round(frame.width)} × ${Math.round(frame.height)}`}
            />
          </div>
        ) : !current && showPlaceholder ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <div className="text-center text-gray-500">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Click to add media</p>
              <p className="text-xs mt-1">from library</p>
            </div>
          </div>
        ) : null}
        {/* One keyed list, so an element keeps its loaded video when it
            moves from preload to pending to shown */}
        {mediaElements.map(m => (
          <MediaElement
            key={m.media.key}
            media={m.media}
            role={m.role}
            startSeq={m.startSeq}
            layerId={frame.layerId}
            playback={playback}
            outputGain={outputGain}
            style={contentStyle}
            onReady={m.onReady}
          />
        ))}
      </div>
    </div>
  );
});
