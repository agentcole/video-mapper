import React, { useEffect, useRef } from 'react';
import { Activity, Trash2 } from 'lucide-react';
import type { LfoShape, Modulation, ModSource } from '../types';
import { useProjectStore } from '../state/projectStore';
import {
  AUDIO_BANDS, DEFAULT_MODULATION, LFO_BEATS, LFO_SECONDS, LFO_SHAPES, periodLabel, sourceLabel,
} from '../state/modulation';
import { field, iconButton, option } from './ui/theme';

// ---------------------------------------------------------------------------
// Modulation controls: the ∿ button next to a parameter, the editor for its
// modulation (source, amount, LFO shape and period) and a live marker on the
// slider showing where the modulated value is right now.
// ---------------------------------------------------------------------------

/**
 * A marker over a slider at the modulated value, moved every animation frame
 * without re-rendering. `value` gives the position as a fraction 0..1.
 */
export const LiveMarker: React.FC<{ value: () => number; className?: string }> = ({ value, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const el = ref.current;
      if (el) el.style.left = `${Math.min(1, Math.max(0, valueRef.current())) * 100}%`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      ref={ref}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm bg-cyan-300 shadow pointer-events-none ${className}`}
    />
  );
};

/** The ∿ button: cyan while a modulation is set. */
export const ModButton: React.FC<{ active: boolean; open: boolean; onClick: () => void; title?: string }> = ({
  active, open, onClick, title,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-0.5 rounded transition-colors ${
      active ? 'bg-cyan-500 text-black' : open ? 'bg-white/20 text-white' : 'text-gray-500 hover:bg-white/10 hover:text-white'
    }`}
    title={title ?? (active ? 'Modulated — edit the modulation' : 'Modulate (LFO, audio, macro)')}
    aria-pressed={active}
  >
    <Activity className="w-3 h-3" />
  </button>
);

// Source choices of the select: 'lfo', 'audio:bass', 'macro:2'
const sourceValue = (source: ModSource): string =>
  source.kind === 'lfo' ? 'lfo' : source.kind === 'audio' ? `audio:${source.band}` : `macro:${source.index}`;

const periodValue = (source: Extract<ModSource, { kind: 'lfo' }>) => `${source.beats ? 'b' : 's'}:${source.period}`;

/** Edit one modulation. */
export const ModEditor: React.FC<{
  mod: Modulation;
  onChange: (mod: Modulation | null) => void;
}> = ({ mod, onChange }) => {
  const macros = useProjectStore(s => s.macros);
  const beatsPerBar = useProjectStore(s => s.tempo.beatsPerBar);
  const { source } = mod;
  const setSource = (next: ModSource) => onChange({ ...mod, source: next });

  const pickSource = (value: string) => {
    if (value === 'lfo') setSource(source.kind === 'lfo' ? source : DEFAULT_MODULATION.source);
    else if (value.startsWith('audio:')) setSource({ kind: 'audio', band: value.slice(6) as Extract<ModSource, { kind: 'audio' }>['band'] });
    else setSource({ kind: 'macro', index: Number(value.slice(6)) });
  };

  return (
    <div className="mt-1 rounded bg-black/40 ring-1 ring-cyan-400/30 p-1.5 space-y-1.5">
      <div className="flex items-center gap-1">
        <select
          value={sourceValue(source)}
          onChange={(e) => pickSource(e.target.value)}
          className={`flex-1 min-w-0 ${field} py-0.5`}
          aria-label="Modulation source"
        >
          <option value="lfo" className={option}>LFO</option>
          <optgroup label="Audio input" className={option}>
            {AUDIO_BANDS.map(b => <option key={b.band} value={`audio:${b.band}`} className={option}>{b.label}</option>)}
          </optgroup>
          <optgroup label="Macros" className={option}>
            {macros.map((m, i) => <option key={i} value={`macro:${i}`} className={option}>{m.name}</option>)}
          </optgroup>
        </select>
        <button type="button" className={iconButton} onClick={() => onChange(null)} title="Remove the modulation">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {source.kind === 'lfo' && (
        <div className="flex items-center gap-1">
          <select
            value={source.shape}
            onChange={(e) => setSource({ ...source, shape: e.target.value as LfoShape })}
            className={`flex-1 min-w-0 ${field} py-0.5`}
            aria-label="LFO shape"
          >
            {LFO_SHAPES.map(s => <option key={s.shape} value={s.shape} className={option}>{s.label}</option>)}
          </select>
          <select
            value={periodValue(source)}
            onChange={(e) => {
              const [unit, n] = e.target.value.split(':');
              setSource({ ...source, period: Number(n), beats: unit === 'b' || undefined });
            }}
            className={`flex-1 min-w-0 ${field} py-0.5`}
            aria-label="LFO period"
            title="One cycle — in beats of the master clock, or in seconds"
          >
            <optgroup label="Beats (synced)" className={option}>
              {LFO_BEATS.map(b => <option key={b} value={`b:${b}`} className={option}>{periodLabel(b, true, beatsPerBar)}</option>)}
            </optgroup>
            <optgroup label="Seconds" className={option}>
              {LFO_SECONDS.map(s => <option key={s} value={`s:${s}`} className={option}>{periodLabel(s, false)}</option>)}
            </optgroup>
          </select>
        </div>
      )}
      {source.kind === 'lfo' && (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-[10px] text-gray-400">
          <span>Phase</span>
          <input
            type="range" min={0} max={1} step={0.01} value={source.phase ?? 0}
            onChange={(e) => setSource({ ...source, phase: Number(e.target.value) || undefined })}
            className="h-1 accent-cyan-400"
            aria-label="LFO phase"
          />
          {(source.shape === 'square' || source.shape === 'pulse') && (
            <>
              <span>{source.shape === 'pulse' ? 'Decay' : 'Width'}</span>
              <input
                type="range" min={0.05} max={1} step={0.01}
                value={source.width ?? (source.shape === 'pulse' ? 0.25 : 0.5)}
                onChange={(e) => setSource({ ...source, width: Number(e.target.value) })}
                className="h-1 accent-cyan-400"
                aria-label={source.shape === 'pulse' ? 'Pulse decay' : 'Square width'}
              />
            </>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-[10px] text-gray-400">
        <span>Amount</span>
        <input
          type="range" min={-100} max={100} step={1} value={Math.round(mod.amount * 100)}
          onChange={(e) => onChange({ ...mod, amount: Number(e.target.value) / 100 })}
          onDoubleClick={() => onChange({ ...mod, amount: DEFAULT_MODULATION.amount })}
          className="flex-1 h-1 accent-cyan-400"
          aria-label="Modulation amount"
          title="How far the source moves the value, in % of its range (negative: down)"
        />
        <span className="w-9 text-right tabular-nums text-gray-300">{Math.round(mod.amount * 100)}%</span>
      </label>
      <p className="text-[10px] text-gray-500 truncate">
        {sourceLabel(source, macros, beatsPerBar)} moves it {mod.amount >= 0 ? 'up' : 'down'} from the set value
      </p>
    </div>
  );
};
