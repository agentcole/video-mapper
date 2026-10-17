import React, { useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import type { MediaFrame, Point } from '../types';
import type { LiveState } from '../state/liveStore';
import { TestCard } from './TestCard';
import { applyHomography, getFrameHomography, getShapeVertices, homographyToCSS } from '../lib/geometry';

// Helper to convert normalized vertices to clip-path polygon string (percent)
const verticesToClipPath = (vertices: Point[] | undefined): string => {
  if (!vertices || vertices.length < 3) return 'none';
  const points = vertices.map(v => `${v.x * 100}% ${v.y * 100}%`).join(', ');
  return `polygon(${points})`;
};

interface FrameContentProps {
  frame: MediaFrame;
  url?: string; // media URL override (the output window resolves its own)
  playback: LiveState['playback']; // Global transport (play / pause all)
  outputGain: number; // master fader × blackout, applied to audio volume
  showPlaceholder: boolean; // editor only: "add media" on empty frames
}

// The visual output of one frame: media through the shape clip and the
// corner-pin homography, blended into the stage. No editor UI and no
// interaction — shared by the editor and the output window.
export const FrameContent = React.memo(function FrameContent({
  frame,
  url = frame.url,
  playback,
  outputGain,
  showPlaceholder,
}: FrameContentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle video playback settings
  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.playbackRate = frame.playbackRate;
    }
  }, [frame.playbackRate, frame.type]);

  // Handle video muted state separately to avoid autoplay issues
  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.muted = frame.muted;
    }
  }, [frame.muted, frame.type]);

  // Master fader / blackout also apply to audio, not just pixels
  useEffect(() => {
    if (videoRef.current && frame.type === 'video') {
      videoRef.current.volume = Math.max(0, Math.min(1, outputGain));
    }
  }, [outputGain, frame.type, url]);

  // Auto-play video when URL changes or on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || frame.type !== 'video' || !url) return;

    const attemptPlay = async () => {
      try {
        // Ensure video is muted for autoplay (browser policy)
        video.muted = true;
        await video.play();
        // Restore muted state after successful autoplay
        video.muted = frame.muted;
      } catch (error) {
        console.warn('Autoplay failed, will play on user interaction:', error);
        // Try again with muted if unmuted failed
        if (!video.muted) {
          video.muted = true;
          video.play().catch(() => {});
        }
      }
    };

    // Try to play when video data is loaded
    const handleLoadedData = () => {
      attemptPlay();
    };

    // If video is already loaded, play immediately
    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('loadeddata', handleLoadedData);
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [url, frame.type, frame.muted]);

  // Handle global playback commands (Play All / Pause All). Only commands
  // sent after this frame mounted apply — a new frame keeps autoplaying.
  const lastPlaybackSeqRef = useRef(playback.seq);
  useEffect(() => {
    if (playback.seq === lastPlaybackSeqRef.current) return;
    lastPlaybackSeqRef.current = playback.seq;
    const video = videoRef.current;
    if (!video || frame.type !== 'video' || !playback.command) return;

    if (playback.command === 'play') {
      video.play().catch((error) => {
        console.warn('Play failed:', error);
        // Try muted play as fallback
        video.muted = true;
        video.play().catch(() => {});
      });
    } else if (playback.command === 'pause') {
      video.pause();
    }
  }, [playback, frame.type]);

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
        ) : url ? (
          frame.type === 'video' ? (
            <video
              ref={videoRef}
              src={url}
              loop={frame.loop}
              muted // Always muted for initial autoplay (browser requirement)
              autoPlay
              className="w-full h-full object-cover"
              style={contentStyle}
              playsInline
            />
          ) : (
            <img
              src={url}
              alt="Media"
              className="w-full h-full object-cover"
              style={contentStyle}
              draggable={false}
            />
          )
        ) : showPlaceholder ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <div className="text-center text-gray-500">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Click to add media</p>
              <p className="text-xs mt-1">from library</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
