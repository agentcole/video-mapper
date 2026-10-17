import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Mic, MicOff, SlidersHorizontal, X } from 'lucide-react';
import type { AudioBand } from '../types';
import { useProjectStore } from '../state/projectStore';
import { liveStore, useLiveStore } from '../state/liveStore';
import { renameMacro, setMacroValue } from '../state/modActions';
import { AUDIO_BANDS } from '../state/modulation';
import { currentAudio } from '../audio/audioBus';
import { SPECTRUM_SIZE } from '../audio/analysis';
import {
  detectedTempo, refreshDevices, startAudioInput, stopAudioInput, syncToDetectedTempo, updateSettings, useAudioInput,
} from '../audio/audioInput';
import { dialogSurface, field, iconButton, option, panelTitle, sectionLabel } from './ui/theme';

// ---------------------------------------------------------------------------
// Audio & macros: the audio input (device, levels, gain), the tempo it
// detects, and the macro faders — the sources parameters are modulated by.
// ---------------------------------------------------------------------------

/** Runs `draw` every animation frame (meters, spectrum) without re-rendering. */
const useFrameLoop = (draw: () => void) => {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      drawRef.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
};

const LevelMeters: React.FC = () => {
  const bars = useRef<Partial<Record<AudioBand, HTMLDivElement | null>>>({});
  useFrameLoop(() => {
    const levels = currentAudio()?.levels;
    for (const { band } of AUDIO_BANDS) {
      const el = bars.current[band];
      if (el) el.style.width = `${Math.round((levels?.[band] ?? 0) * 100)}%`;
    }
  });
  return (
    <div className="grid grid-cols-[2.5rem_1fr] items-center gap-x-2 gap-y-1">
      {AUDIO_BANDS.map(({ band, label }) => (
        <React.Fragment key={band}>
          <span className="text-[10px] text-gray-400">{label}</span>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              ref={el => { bars.current[band] = el; }}
              className={`h-full rounded-full ${band === 'kick' ? 'bg-amber-400' : 'bg-cyan-400'}`}
              style={{ width: 0 }}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const SpectrumView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFrameLoop(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const spectrum = currentAudio()?.spectrum;
    if (!spectrum) return;
    // 30 Hz … 16 kHz on a log scale (bins span 0 Hz … Nyquist ≈ 24 kHz)
    ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
    const columns = 64;
    for (let i = 0; i < columns; i++) {
      const hz = 30 * (16000 / 30) ** ((i + 0.5) / columns);
      const bin = Math.min(SPECTRUM_SIZE - 1, Math.round((hz / 24000) * SPECTRUM_SIZE));
      const v = spectrum[bin] / 255;
      const w = width / columns;
      ctx.fillRect(i * w + 0.5, height * (1 - v), w - 1, height * v);
    }
  });
  return <canvas ref={canvasRef} width={256} height={40} className="w-full h-10 rounded bg-black/40" />;
};

const AudioInputSection: React.FC = () => {
  const status = useAudioInput(s => s.status);
  const error = useAudioInput(s => s.error);
  const devices = useAudioInput(s => s.devices);
  const settings = useAudioInput(s => s.settings);
  const on = status === 'on';

  useEffect(() => {
    void refreshDevices();
    const onChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, []);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <p className={`${sectionLabel} flex-1`}>Audio input</p>
        <span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : status === 'error' ? 'bg-red-500' : 'bg-white/20'}`} />
        <span className="text-[10px] text-gray-400">{on ? 'Listening' : status === 'starting' ? 'Starting…' : status === 'error' ? 'Error' : 'Off'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={settings.deviceId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            if (on || status === 'error') void startAudioInput(id);
            else updateSettings({ deviceId: id });
          }}
          className={`flex-1 min-w-0 ${field}`}
          aria-label="Audio input device"
        >
          <option value="" className={option}>System default</option>
          {devices.map(d => <option key={d.id} value={d.id} className={option}>{d.label}</option>)}
        </select>
        <button
          onClick={() => (on || status === 'starting' ? stopAudioInput() : void startAudioInput())}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${on ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'bg-white/10 hover:bg-white/20'}`}
          title={on ? 'Stop listening' : 'Listen to this input'}
        >
          {on ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          {on ? 'On' : 'Off'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
      <LevelMeters />
      <SpectrumView />
      <div className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-x-2 gap-y-1.5 text-[11px] text-gray-400">
        <label className="flex items-center gap-1 cursor-pointer" title="Each band follows its own recent peak: always full range, whatever the room level">
          <input type="checkbox" checked={settings.autoGain} onChange={(e) => updateSettings({ autoGain: e.target.checked })} className="accent-cyan-400" />
          Auto gain
        </label>
        <input
          type="range" min={-24} max={36} step={1} value={settings.gain}
          disabled={settings.autoGain}
          onChange={(e) => updateSettings({ gain: Number(e.target.value) })}
          onDoubleClick={() => updateSettings({ gain: 0 })}
          className="h-1 accent-cyan-400 disabled:opacity-30"
          aria-label="Input gain"
        />
        <span className={`text-right tabular-nums ${settings.autoGain ? 'text-gray-600' : 'text-gray-300'}`}>
          {settings.gain > 0 ? '+' : ''}{settings.gain} dB
        </span>
        <span title="How slowly levels fall after a peak">Smoothing</span>
        <input
          type="range" min={0} max={1} step={0.01} value={settings.smoothing}
          onChange={(e) => updateSettings({ smoothing: Number(e.target.value) })}
          className="h-1 accent-cyan-400"
          aria-label="Smoothing"
        />
        <span className="text-right tabular-nums text-gray-300">{Math.round(settings.smoothing * 100)}%</span>
      </div>
      {!on && status !== 'error' && (
        <p className="text-[10px] text-gray-500">
          A microphone, line in or loopback device (e.g. BlackHole, VB-Cable) for the music. Audio drives modulation and the audio shaders in every output window.
        </p>
      )}
    </section>
  );
};

const TempoSection: React.FC = () => {
  const on = useAudioInput(s => s.status === 'on');
  const tempo = useAudioInput(s => s.tempo);
  const follow = useAudioInput(s => s.settings.follow);
  const masterBpm = useProjectStore(s => s.tempo.bpm);
  const detected = tempo ? detectedTempo() : null;
  const sure = !!detected && detected.confidence >= 0.5;
  return (
    <section className="space-y-2">
      <p className={sectionLabel}>Tempo from audio</p>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-semibold tabular-nums ${sure ? 'text-white' : 'text-gray-500'}`}>
          {detected ? detected.bpm.toFixed(1) : '—'}
        </span>
        <span className="text-[10px] text-gray-500 flex-1">
          {!on ? 'Turn the input on' : !detected ? 'Listening…' : detected.stable ? `BPM · steady${sure ? '' : ', unsure'}` : 'BPM · settling'}
        </span>
        <button
          onClick={() => syncToDetectedTempo()}
          disabled={!detected}
          className="px-2 py-1 rounded bg-amber-500 text-black text-xs font-semibold disabled:bg-white/10 disabled:text-white/40"
          title={`Take this tempo and put the beat where the music has it (master: ${masterBpm} BPM). The bar start stays yours — Resync if needed.`}
        >
          Sync
        </button>
        <label
          className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs cursor-pointer ${follow ? 'bg-amber-500 text-black font-semibold' : 'bg-white/10 hover:bg-white/20'}`}
          title="Keep the master clock on the detected tempo and beat while it is steady"
        >
          <input type="checkbox" checked={follow} onChange={(e) => updateSettings({ follow: e.target.checked })} className="sr-only" />
          Follow
        </label>
      </div>
      {detected && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden" title={`Confidence ${Math.round(detected.confidence * 100)}%`}>
          <div className="h-full bg-amber-400" style={{ width: `${Math.round(detected.confidence * 100)}%` }} />
        </div>
      )}
    </section>
  );
};

const MacroRow: React.FC<{ index: number; name: string; value: number }> = ({ index, name, value }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2" data-control={`macro:${index}`}>
      {draft !== null ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            renameMacro(index, draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setDraft(null);
          }}
          className={`w-20 ${field} py-0.5`}
          maxLength={40}
        />
      ) : (
        <span className="w-20 truncate text-[11px] text-gray-300 cursor-text" onDoubleClick={() => setDraft(name)} title={`${name} — double-click to rename`}>
          {name}
        </span>
      )}
      <input
        type="range" min={0} max={1000} value={Math.round(value * 1000)}
        onChange={(e) => setMacroValue(index, Number(e.target.value) / 1000)}
        className="flex-1 h-1 accent-cyan-400"
        aria-label={name}
      />
      <span className="w-8 text-right tabular-nums text-[10px] text-gray-300">{Math.round(value * 100)}%</span>
    </div>
  );
};

const MacroSection: React.FC = () => {
  const macros = useProjectStore(s => s.macros);
  return (
    <section className="space-y-1.5">
      <p className={sectionLabel}>Macros</p>
      {macros.map((m, i) => <MacroRow key={i} index={i} name={m.name} value={m.value} />)}
      <p className="text-[10px] text-gray-500">Pick a macro as the source of any parameter's ∿ modulation — one fader can drive many.</p>
    </section>
  );
};

export const DashboardPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const renderer = useLiveStore(s => s.renderer);
  return (
    <div
      className={`fixed left-4 z-[1200] w-72 ${dialogSurface} flex flex-col`}
      style={{ bottom: 'calc(var(--launcher-height, 0px) + 16px)', maxHeight: 'calc(100vh - var(--launcher-height, 0px) - 48px)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <h3 className={`${panelTitle} flex-1`}>
          <SlidersHorizontal className="w-4 h-4" />
          Audio & Macros
        </h3>
        <button onClick={onClose} className={iconButton} title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto p-3 space-y-4">
        {renderer !== 'gpu' && (
          <div className="rounded bg-amber-500/15 ring-1 ring-amber-400/50 px-2 py-1.5 text-[11px] text-amber-100 flex items-center gap-2">
            <span className="flex-1">Modulation shows with the GPU renderer.</span>
            <button
              className="px-2 py-0.5 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
              onClick={() => liveStore.getState().setRenderer('gpu')}
            >
              Use GPU
            </button>
          </div>
        )}
        <AudioInputSection />
        <TempoSection />
        <MacroSection />
      </div>
    </div>
  );
};

/** Launcher toolbar: the audio input at a glance (mini meter, detected tempo); opens the panel. */
export const AudioChip: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => {
  const on = useAudioInput(s => s.status === 'on');
  const error = useAudioInput(s => s.status === 'error');
  const tempo = useAudioInput(s => s.tempo);
  const follow = useAudioInput(s => s.settings.follow);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useFrameLoop(() => {
    const levels = currentAudio()?.levels;
    (['bass', 'mid', 'high'] as const).forEach((band, i) => {
      const el = bars.current[i];
      if (el) el.style.height = `${Math.max(12, Math.round((levels?.[band] ?? 0) * 100))}%`;
    });
  });
  const detected = tempo ? detectedTempo() : null;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded ${open ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'}`}
      title="Audio input, tempo detection and macros"
    >
      {on ? <AudioLines className="w-3.5 h-3.5 text-emerald-300" /> : <MicOff className={`w-3.5 h-3.5 ${error ? 'text-red-400' : 'text-gray-400'}`} />}
      {on && (
        <span className="flex items-end gap-px h-3">
          {[0, 1, 2].map(i => (
            <span key={i} ref={el => { bars.current[i] = el; }} className="w-1 rounded-sm bg-cyan-400" style={{ height: '12%' }} />
          ))}
        </span>
      )}
      {on && detected && detected.confidence >= 0.5 && (
        <span className={`tabular-nums ${follow ? 'text-amber-300' : 'text-gray-300'}`}>♪ {detected.bpm.toFixed(1)}</span>
      )}
      <span>Audio</span>
    </button>
  );
};
