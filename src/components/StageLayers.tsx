import React, { useEffect, useRef } from 'react';
import type { BackgroundSettings, GridSettings } from '../types';
import type { LiveState } from '../state/liveStore';

// Stage layers shared by the editor and the output window

interface BackgroundLayerProps {
  background: BackgroundSettings;
  url?: string; // media URL override (the output window resolves its own)
  outputGain: number;
  playback: LiveState['playback'];
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  background,
  url = background.url,
  outputGain,
  playback,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Master fader and blackout apply to audio as well as pixels
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, outputGain));
  }, [outputGain, background.type, url]);

  // Play / pause all also drives the background video
  const lastPlaybackSeqRef = useRef(playback.seq);
  useEffect(() => {
    if (playback.seq === lastPlaybackSeqRef.current) return;
    lastPlaybackSeqRef.current = playback.seq;
    const video = videoRef.current;
    if (!video || !playback.command) return;
    if (playback.command === 'play') video.play().catch(() => {});
    else video.pause();
  }, [playback]);

  if (background.type === 'color') {
    return (
      <div
        data-canvas-bg="true"
        className="absolute inset-0"
        style={{ backgroundColor: background.color }}
      />
    );
  }
  if (background.type === 'image' && url) {
    return (
      <img
        src={url}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
    );
  }
  if (background.type === 'video' && url) {
    return (
      <video
        ref={videoRef}
        src={url}
        loop={background.loop ?? true}
        muted={background.muted ?? true}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
    );
  }
  return null;
};

// Grid overlay — minor lines every cell, accent lines every 5 cells
export const GridOverlay: React.FC<{ grid: GridSettings }> = ({ grid }) => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      zIndex: 500,
      backgroundImage: [
        'linear-gradient(to right, rgba(34,211,238,0.35) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(34,211,238,0.35) 1px, transparent 1px)',
        'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
      ].join(', '),
      backgroundSize: [
        `${grid.size * 5}px ${grid.size * 5}px`,
        `${grid.size * 5}px ${grid.size * 5}px`,
        `${grid.size}px ${grid.size}px`,
        `${grid.size}px ${grid.size}px`,
      ].join(', '),
    }}
  />
);
