import React, { useMemo, useRef, useState } from 'react';
import {
  Activity, ChevronDown, ChevronUp, Plus, RotateCcw, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import type { EffectInstance, EffectParamValue, ModMap, Modulation } from '../types';
import { useProjectStore } from '../state/projectStore';
import { liveStore, useLiveStore } from '../state/liveStore';
import { findClip } from '../state/showModel';
import {
  addEffect, moveEffect, removeEffect, resetEffect, resetGenerator, setEffectMod, setEffectParam, setGeneratorMod,
  setGeneratorParam, stackOf, toggleEffect, type EffectTarget,
} from '../state/effectActions';
import { defaultModulation, hasMods, modKey } from '../state/modulation';
import { effectsOfKind, importIsf, useEffectLibrary, type EffectDef } from '../effects/library';
import { inputRange, paramValue, type IsfInput } from '../effects/isf';
import { LiveMarker, ModButton, ModEditor } from './ModControls';
import { liveValue } from '../state/liveModulation';
import { dialogSurface, field, iconButton, option, panelTitle, sectionLabel } from './ui/theme';

// ---------------------------------------------------------------------------
// Effect editor: the ISF effect stack of a clip, a layer or the composition
// (top to bottom = first to last), and a generator clip's parameters. Number
// parameters can be modulated (∿). Effects, generators and modulation render
// with the GPU renderer.
// ---------------------------------------------------------------------------

// ---- Parameter controls ------------------------------------------------------------

const toHex = (rgba: number[]) =>
  `#${rgba.slice(0, 3).map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;

const fromHex = (hex: string, alpha: number): number[] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
};

const formatNumber = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

// Modulation of the parameters of one effect / generator
interface ModProps {
  mods: ModMap | undefined;
  onMod: (key: string, mod: Modulation | null) => void;
  seedKey: string; // as the renderer seeds random LFOs (effect instance id, `gen:<clip id>`)
}

/** A number slider with its modulation: ∿ button, live marker and editor. */
const Slider: React.FC<ModProps & {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; paramKey: string;
}> = ({ value, min, max, onChange, label, paramKey, mods, onMod, seedKey }) => {
  const [open, setOpen] = useState(false);
  const mod = mods?.[paramKey];
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={(max - min) / 500}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 accent-cyan-400"
            aria-label={label}
          />
          {mod && <LiveMarker value={() => (liveValue(value, mod, min, max, `${seedKey}|${paramKey}`) - min) / (max - min)} />}
        </div>
        <span className="w-10 text-right tabular-nums text-[10px] text-gray-300">{formatNumber(value)}</span>
        <ModButton
          active={!!mod}
          open={open}
          onClick={() => {
            if (!mod) {
              onMod(paramKey, defaultModulation(value, min, max));
              setOpen(true);
            } else {
              setOpen(o => !o);
            }
          }}
        />
      </div>
      {mod && open && (
        <ModEditor
          mod={mod}
          onChange={(next) => {
            onMod(paramKey, next);
            if (!next) setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const ParamControl: React.FC<ModProps & {
  input: IsfInput;
  value: EffectParamValue | undefined;
  onChange: (value: EffectParamValue) => void;
}> = ({ input, value, onChange, ...modProps }) => {
  const v = paramValue(input, value);
  const label = input.label || input.name;
  switch (input.type) {
    case 'float': {
      const [min, max] = inputRange(input);
      return (
        <div>
          <span className="text-[11px] text-gray-400">{label}</span>
          <Slider value={v as number} min={min} max={max} onChange={onChange} label={label} paramKey={modKey(input.name)} {...modProps} />
        </div>
      );
    }
    case 'long': {
      const values = input.values ?? [0, 1];
      return (
        <label className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
          <select value={v as number} onChange={(e) => onChange(Number(e.target.value))} className={`flex-1 min-w-0 ${field}`}>
            {values.map((value, i) => (
              <option key={value} value={value} className={option}>{input.labels?.[i] ?? value}</option>
            ))}
          </select>
        </label>
      );
    }
    case 'bool':
    case 'event':
      return (
        <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
          <input type="checkbox" checked={v as boolean} onChange={(e) => onChange(e.target.checked)} className="accent-cyan-400" />
          {label}
        </label>
      );
    case 'color': {
      const rgba = v as number[];
      return (
        <label className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 shrink-0 w-20 truncate">{label}</span>
          <input
            type="color"
            value={toHex(rgba)}
            onChange={(e) => onChange(fromHex(e.target.value, rgba[3] ?? 1))}
            className="w-7 h-6 rounded bg-transparent cursor-pointer"
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={rgba[3] ?? 1}
            onChange={(e) => onChange([rgba[0], rgba[1], rgba[2], Number(e.target.value)])}
            className="flex-1 h-1 accent-cyan-400"
            title="Alpha"
            aria-label={`${label} alpha`}
          />
        </label>
      );
    }
    case 'point2D': {
      const point = v as number[];
      return (
        <div>
          <span className="text-[11px] text-gray-400">{label}</span>
          {[0, 1].map(axis => {
            const [min, max] = inputRange(input, axis);
            return (
              <Slider
                key={axis}
                value={point[axis]}
                min={min}
                max={max}
                label={`${label} ${axis === 0 ? 'x' : 'y'}`}
                paramKey={modKey(input.name, axis)}
                onChange={(n) => onChange(axis === 0 ? [n, point[1]] : [point[0], n])}
                {...modProps}
              />
            );
          })}
        </div>
      );
    }
    default:
      return null; // images (the input), audio: not editable here
  }
};

const Params: React.FC<ModProps & {
  def: EffectDef;
  params: Record<string, EffectParamValue>;
  onChange: (name: string, value: EffectParamValue) => void;
}> = ({ def, params, onChange, ...modProps }) => {
  const inputs = def.shader?.inputs.filter(i => i.type !== 'image' && i.type !== 'audio' && i.type !== 'audioFFT') ?? [];
  const listens = def.shader?.inputs.some(i => i.type === 'audio' || i.type === 'audioFFT');
  return (
    <div className="space-y-2">
      {listens && <p className="text-[10px] text-gray-500">Listens to the audio input.</p>}
      {inputs.length === 0 && <p className="text-[11px] text-gray-500">No parameters</p>}
      {inputs.map(input => (
        <ParamControl key={input.name} input={input} value={params[input.name]} onChange={(v) => onChange(input.name, v)} {...modProps} />
      ))}
    </div>
  );
};

// ---- One effect in the stack -----------------------------------------------------------

const EffectItem: React.FC<{
  target: EffectTarget;
  instance: EffectInstance;
  def: EffectDef | undefined;
  error?: string;
  first: boolean;
  last: boolean;
}> = ({ target, instance, def, error, first, last }) => {
  const [open, setOpen] = useState(true);
  return (
    <li className={`rounded bg-white/5 ${instance.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          type="checkbox"
          checked={instance.enabled}
          onChange={() => toggleEffect(target, instance.id)}
          className="accent-cyan-400"
          title={instance.enabled ? 'Bypass' : 'Turn on'}
        />
        <button className="flex-1 min-w-0 text-left text-xs font-semibold truncate flex items-center gap-1" onClick={() => setOpen(o => !o)}>
          <span className="truncate">{def?.name ?? instance.effectId}</span>
          {hasMods(instance.mods) && <Activity className="w-3 h-3 shrink-0 text-cyan-300" aria-label="Modulated" />}
        </button>
        <button className={iconButton} disabled={first} onClick={() => moveEffect(target, instance.id, -1)} title="Earlier in the stack">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button className={iconButton} disabled={last} onClick={() => moveEffect(target, instance.id, 1)} title="Later in the stack">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button className={iconButton} onClick={() => resetEffect(target, instance.id)} title="Reset parameters">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 rounded hover:bg-red-600 transition-colors" onClick={() => removeEffect(target, instance.id)} title="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2">
          {!def ? (
            <p className="text-[11px] text-amber-300">Shader not in this browser's library — import it to see it.</p>
          ) : def.error || error ? (
            <p className="text-[11px] text-red-300 whitespace-pre-wrap break-words">{def.error ?? error}</p>
          ) : (
            <Params
              def={def}
              params={instance.params}
              onChange={(name, v) => setEffectParam(target, instance.id, name, v)}
              mods={instance.mods}
              onMod={(key, mod) => setEffectMod(target, instance.id, key, mod)}
              seedKey={instance.id}
            />
          )}
        </div>
      )}
    </li>
  );
};

// ---- Picker -------------------------------------------------------------------------------

const EffectPicker: React.FC<{ onPick: (def: EffectDef) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const defs = useEffectLibrary(s => s.defs);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = effectsOfKind(defs, 'effect').filter(d =>
      !q || d.name.toLowerCase().includes(q) || d.categories.some(c => c.toLowerCase().includes(q)));
    const byCategory = new Map<string, EffectDef[]>();
    for (const d of list) byCategory.set(d.categories[0], [...(byCategory.get(d.categories[0]) ?? []), d]);
    return [...byCategory.entries()];
  }, [defs, query]);

  const importFiles = async (files: FileList) => {
    const results: string[] = [];
    for (const file of Array.from(files)) {
      const def = await importIsf(file.name, await file.text());
      results.push(def.error ? `${file.name}: ${def.error}` : `${def.name} (${def.kind}) added`);
    }
    setMessage(results.join('\n'));
  };

  return (
    <div className="mt-2 rounded bg-black/40 ring-1 ring-white/10">
      <div className="flex items-center gap-1 p-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Search effects…"
          className={`flex-1 min-w-0 ${field}`}
        />
        <button className={iconButton} onClick={() => fileRef.current?.click()} title="Import ISF shaders (.fs)">
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button className={iconButton} onClick={onClose} title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".fs,.frag,.isf,.glsl,.txt"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p className="px-2 pb-1 text-[10px] text-gray-300 whitespace-pre-wrap">{message}</p>}
      <div className="max-h-56 overflow-y-auto px-1.5 pb-1.5 space-y-1.5">
        {groups.map(([category, list]) => (
          <div key={category}>
            <p className={`px-1 ${sectionLabel}`}>{category}</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {list.map(d => (
                <button
                  key={d.id}
                  onClick={() => onPick(d)}
                  className="px-1.5 py-0.5 rounded text-[11px] bg-white/10 hover:bg-cyan-500 hover:text-black"
                  title={d.shader?.description || d.name}
                >
                  {d.name}{d.builtin ? '' : ' ·'}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="px-1 text-[11px] text-gray-500">Nothing found</p>}
      </div>
    </div>
  );
};

// ---- Panel ----------------------------------------------------------------------------------

interface EffectsPanelProps {
  target: EffectTarget;
  onClose: () => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ target, onClose }) => {
  const stack = useProjectStore(s => stackOf(target, s));
  const title = useProjectStore(s => {
    if (target.kind === 'composition') return 'Composition';
    if (target.kind === 'layer') return s.layers.find(l => l.id === target.layerId)?.name ?? 'Layer';
    for (const layer of s.layers) {
      const clip = findClip(layer, target.clipId);
      if (clip) return clip.name || clip.source.filename || 'Clip';
    }
    return 'Clip';
  });
  const generator = useProjectStore(s => {
    if (target.kind !== 'clip') return undefined;
    for (const layer of s.layers) {
      const clip = findClip(layer, target.clipId);
      if (clip) return clip.generator;
    }
    return undefined;
  });
  const defs = useEffectLibrary(s => s.defs);
  const compileErrors = useEffectLibrary(s => s.compileErrors);
  const renderer = useLiveStore(s => s.renderer);
  const [picking, setPicking] = useState(false);
  const generatorDef = generator ? defs[generator.effectId] : undefined;

  return (
    <div
      className={`fixed right-4 z-[1200] w-72 ${dialogSurface} flex flex-col`}
      style={{ bottom: 'calc(var(--launcher-height, 0px) + 16px)', maxHeight: 'calc(100vh - var(--launcher-height, 0px) - 48px)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <h3 className={`${panelTitle} flex-1 min-w-0`}>
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">Effects · {title}</span>
        </h3>
        <button onClick={onClose} className={iconButton} title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto p-3 space-y-3">
        {renderer !== 'gpu' && (
          <div className="rounded bg-amber-500/15 ring-1 ring-amber-400/50 px-2 py-1.5 text-[11px] text-amber-100 flex items-center gap-2">
            <span className="flex-1">Effects, generators and modulation show with the GPU renderer.</span>
            <button
              className="px-2 py-0.5 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
              onClick={() => liveStore.getState().setRenderer('gpu')}
            >
              Use GPU
            </button>
          </div>
        )}

        {generator && target.kind === 'clip' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Generator · {generatorDef?.name ?? generator.effectId}</p>
              <button className={iconButton} onClick={() => resetGenerator(target.clipId)} title="Reset parameters">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            {generatorDef ? (
              compileErrors[generatorDef.id] ? (
                <p className="text-[11px] text-red-300 whitespace-pre-wrap">{compileErrors[generatorDef.id]}</p>
              ) : (
                <Params
                  def={generatorDef}
                  params={generator.params}
                  onChange={(name, v) => setGeneratorParam(target.clipId, name, v)}
                  mods={generator.mods}
                  onMod={(key, mod) => setGeneratorMod(target.clipId, key, mod)}
                  seedKey={`gen:${target.clipId}`}
                />
              )
            ) : (
              <p className="text-[11px] text-amber-300">Shader not in this browser's library.</p>
            )}
          </section>
        )}

        <section className="space-y-2">
          <p className={sectionLabel}>Effect stack{stack.length > 0 ? ` · ${stack.length}` : ''}</p>
          {stack.length === 0 && !picking && (
            <p className="text-[11px] text-gray-500">
              No effects. They run top to bottom on {target.kind === 'composition' ? 'the whole output' : target.kind === 'layer' ? 'whatever this layer plays' : 'this clip'}.
            </p>
          )}
          <ul className="space-y-1.5">
            {stack.map((instance, i) => (
              <EffectItem
                key={instance.id}
                target={target}
                instance={instance}
                def={defs[instance.effectId]}
                error={compileErrors[instance.effectId]}
                first={i === 0}
                last={i === stack.length - 1}
              />
            ))}
          </ul>
          {picking ? (
            <EffectPicker
              onPick={(def) => {
                addEffect(target, def.id);
                setPicking(false);
              }}
              onClose={() => setPicking(false)}
            />
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="w-full flex items-center justify-center gap-1.5 h-7 rounded bg-white/10 hover:bg-white/20 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add effect
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
