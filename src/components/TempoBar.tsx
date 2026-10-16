import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Timer } from 'lucide-react';
import type { BeatSnap } from '../types';
import { useProjectStore } from '../state/projectStore';
import { liveStore, useLiveStore } from '../state/liveStore';
import { BEAT_SNAPS, barPosition, beatAt, clockNow } from '../state/clock';
import { currentClock } from '../state/deckActions';
import {
  resyncBar, scaleTempo, setBeatSnap, setBeatsPerBar, setBpm, startNudge, tapTempo,
} from '../state/clockActions';

// ---------------------------------------------------------------------------
// Master clock controls in the launcher toolbar: tap, BPM, ÷2 ×2, nudge,
// resync, the beat display and the composition's beat snap.
// ---------------------------------------------------------------------------

const formatBpm = (bpm: number) => (Number.isInteger(bpm) ? bpm.toFixed(0) : bpm.toFixed(1));

const BpmInput: React.FC<{ bpm: number }> = ({ bpm }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    if (value.trim() && Number.isFinite(parsed)) setBpm(parsed);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? formatBpm(bpm)}
      onFocus={(e) => {
        setDraft(formatBpm(bpm));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && !cancelled.current) commit(draft);
        cancelled.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = (e.shiftKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
          const next = Math.round((bpm + step) * 10) / 10;
          setBpm(next);
          setDraft(formatBpm(next));
        }
      }}
      className="w-12 bg-white/10 rounded px-1 py-0.5 text-right tabular-nums text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
      title="Tempo (BPM) — type a value, arrows ±1 (Shift ±0.1)"
      aria-label="Tempo in BPM"
    />
  );
};

/** One dot per beat of the bar, lit on the current beat; the time until a waiting trigger fires. */
const BeatDisplay: React.FC<{ beatsPerBar: number }> = ({ beatsPerBar }) => {
  const [position, setPosition] = useState({ bar: 0, beat: 0 });
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = clockNow();
      const clock = currentClock();
      const { bar, beat } = barPosition(clock, now, beatsPerBar);
      setPosition(p => (p.bar === bar && p.beat === beat ? p : { bar, beat }));
      const { scheduled } = liveStore.getState();
      const next = scheduled.length > 0 ? Math.min(...scheduled.map(t => t.at)) : null;
      // Whole beats to go (rounded up), so the count ends on 1
      const beats = next !== null ? Math.max(1, Math.ceil(beatAt(clock, next) - beatAt(clock, now) - 1e-6)) : null;
      setCountdown(c => (c === beats ? c : beats));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [beatsPerBar]);

  return (
    <span className="flex items-center gap-1.5" title="Bar and beat of the master clock">
      <span className="flex items-center gap-1">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={`rounded-full ${i === 0 ? 'w-2.5 h-2.5' : 'w-2 h-2'} ${
              i === position.beat ? (i === 0 ? 'bg-amber-400' : 'bg-cyan-300') : 'bg-white/15'
            }`}
          />
        ))}
      </span>
      <span className="tabular-nums text-gray-400 w-8">{position.bar + 1}.{position.beat + 1}</span>
      {countdown !== null && (
        <span className="flex items-center gap-0.5 tabular-nums text-amber-300" title="Beats until the next waiting trigger fires">
          <Timer className="w-3 h-3" />
          {countdown}
        </span>
      )}
    </span>
  );
};

const NudgeButton: React.FC<{ direction: 1 | -1 }> = ({ direction }) => {
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const stop = startNudge(direction);
    const up = () => {
      stop();
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className="p-0.5 rounded bg-white/10 hover:bg-white/20"
      title={direction > 0 ? 'Push the beat ahead (hold)' : 'Hold the beat back (hold)'}
    >
      {direction > 0 ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
    </button>
  );
};

const blurAfter = (fn: () => void) => (e: React.SyntheticEvent<HTMLElement>) => {
  fn();
  // Give the keyboard back to the launcher shortcuts
  e.currentTarget.blur();
};

export const TempoBar: React.FC = () => {
  const tempo = useProjectStore(s => s.tempo);
  const waiting = useLiveStore(s => s.scheduled.length > 0);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5">
      <button
        type="button"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault(); // a tap must not wait for the click (pointer up)
          tapTempo();
        }}
        className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 active:bg-cyan-500 active:text-black font-semibold"
        title="Tap the beat (T). The first tap is the downbeat."
      >
        Tap
      </button>
      <BpmInput bpm={tempo.bpm} />
      <span className="text-gray-500">BPM</span>
      <button type="button" onClick={blurAfter(() => scaleTempo(0.5))} className="px-1 rounded bg-white/10 hover:bg-white/20" title="Half tempo">
        ÷2
      </button>
      <button type="button" onClick={blurAfter(() => scaleTempo(2))} className="px-1 rounded bg-white/10 hover:bg-white/20" title="Double tempo">
        ×2
      </button>
      <NudgeButton direction={-1} />
      <NudgeButton direction={1} />
      <button
        type="button"
        onClick={blurAfter(resyncBar)}
        className="p-0.5 rounded bg-white/10 hover:bg-white/20"
        title="Resync: now is the start of a bar (Shift+T)"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
      <BeatDisplay beatsPerBar={tempo.beatsPerBar} />
      <select
        value={tempo.beatsPerBar}
        onChange={(e) => {
          setBeatsPerBar(Number(e.target.value));
          e.currentTarget.blur();
        }}
        className="bg-white/10 rounded px-0.5 py-0.5 text-white focus:outline-none"
        title="Beats per bar"
      >
        {[2, 3, 4, 5, 6, 7, 8].map(n => (
          <option key={n} value={n} className="bg-gray-900">{n}/4</option>
        ))}
      </select>
      <label className={`flex items-center gap-1 ${waiting ? 'text-amber-300' : 'text-gray-400'}`} title="Beat snap: triggers wait for the next beat / bar (Alt + trigger fires now)">
        Snap
        <select
          value={tempo.beatSnap}
          onChange={(e) => {
            setBeatSnap(e.target.value as BeatSnap);
            e.currentTarget.blur();
          }}
          className={`rounded px-0.5 py-0.5 focus:outline-none ${tempo.beatSnap === 'off' ? 'bg-white/10 text-white' : 'bg-amber-500 text-black font-semibold'}`}
        >
          {BEAT_SNAPS.map(({ snap, label }) => (
            <option key={snap} value={snap} className="bg-gray-900 text-white font-normal">{label}</option>
          ))}
        </select>
      </label>
    </div>
  );
};
