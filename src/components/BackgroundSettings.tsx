import React, { useRef } from 'react';
import type { BackgroundSettings } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { dialogSurface, iconButton, panelTitle, sectionLabel, segment, segmented } from './ui/theme';
import {
  Palette,
  Image as ImageIcon,
  Video,
  X,
  FolderOpen,
} from 'lucide-react';

interface BackgroundSettingsProps {
  background: BackgroundSettings;
  onUpdate: (settings: BackgroundSettings) => void;
  onOpenMediaLibrary: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#1e293b', // Slate-800
  '#0f172a', // Slate-900
  '#18181b', // Zinc-900
  '#171717', // Neutral-900
  '#1c1917', // Stone-900
  '#ffffff', // White
  '#ef4444', // Red-500
  '#22c55e', // Green-500
  '#3b82f6', // Blue-500
  '#a855f7', // Purple-500
  '#f97316', // Orange-500
];

export const BackgroundSettingsPanel: React.FC<BackgroundSettingsProps> = ({
  background,
  onUpdate,
  onOpenMediaLibrary,
  isOpen,
  onClose,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className={`fixed top-4 left-[284px] ${dialogSurface} p-3 z-[1000] w-64`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={panelTitle}>
          <Palette className="w-4 h-4" />
          Background
        </h3>
        <button onClick={onClose} className={iconButton} title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Type Selection */}
      <div className="space-y-2">
        <p className={sectionLabel}>Type</p>
        <div className={segmented}>
          <button className={segment(background.type === 'color')} onClick={() => onUpdate({ ...background, type: 'color' })}>
            <Palette className="w-3.5 h-3.5" /> Color
          </button>
          <button className={segment(background.type === 'image')} onClick={() => onUpdate({ ...background, type: 'image' })}>
            <ImageIcon className="w-3.5 h-3.5" /> Image
          </button>
          <button className={segment(background.type === 'video')} onClick={() => onUpdate({ ...background, type: 'video' })}>
            <Video className="w-3.5 h-3.5" /> Video
          </button>
        </div>
      </div>

      {/* Color Options */}
      {background.type === 'color' && (
        <div className="mt-3 space-y-2">
          <p className={sectionLabel}>Color</p>
          
          {/* Preset Colors */}
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onUpdate({ ...background, color })}
                className={`aspect-square rounded transition-shadow ${
                  background.color === color
                    ? 'ring-2 ring-cyan-400'
                    : 'ring-1 ring-white/10 hover:ring-white/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Custom Color */}
          <div className="flex gap-2 items-center">
            <input
              ref={colorInputRef}
              type="color"
              value={background.color}
              onChange={(e) => onUpdate({ ...background, color: e.target.value })}
              className="w-8 h-8 shrink-0 rounded cursor-pointer bg-transparent"
            />
            <Input
              type="text"
              value={background.color}
              onChange={(e) => onUpdate({ ...background, color: e.target.value })}
              className="flex-1 font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      )}

      {/* Image/Video Options */}
      {(background.type === 'image' || background.type === 'video') && (
        <div className="mt-3 space-y-2">
          <p className={sectionLabel}>
            {background.type === 'image' ? 'Image' : 'Video'} Source
          </p>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMediaLibrary}
            className="w-full"
          >
            <FolderOpen />
            Select from library
          </Button>

          {background.url && (
            <div className="px-2 py-1 bg-white/5 rounded text-[11px] text-gray-400 truncate">
              Current: {background.url.substring(0, 40)}...
            </div>
          )}

          {background.type === 'video' && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={background.loop ?? true}
                  onChange={(e) => onUpdate({ ...background, loop: e.target.checked })}
                  className="accent-cyan-400"
                />
                Loop video
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={background.muted ?? true}
                  onChange={(e) => onUpdate({ ...background, muted: e.target.checked })}
                  className="accent-cyan-400"
                />
                Mute audio
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
