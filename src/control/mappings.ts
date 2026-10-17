import { createStore, useStore } from 'zustand';
import type { CcEncoding, MidiMessage } from './midiMessages';
import type { ButtonState } from './targets';

// ---------------------------------------------------------------------------
// Mappings: which MIDI control or key drives which target, and how the
// controller shows the target's state (LEDs, rings). They belong to this
// machine and its controllers, not to the project, so they're kept in
// localStorage and work with every project.
// ---------------------------------------------------------------------------

export type ControlSource =
  | { kind: 'note'; device: string; channel: number; note: number }
  | { kind: 'cc'; device: string; channel: number; cc: number; encoding?: CcEncoding }
  | { kind: 'pitchbend'; device: string; channel: number }
  | { kind: 'key'; code: string; shift?: boolean; alt?: boolean };

// A message the controller understands to show a state: on the source's
// own note / CC unless the template says otherwise (e.g. a colour channel)
export interface FeedbackMessage {
  channel?: number;
  value: number;
}

export interface Feedback {
  type?: 'note' | 'cc'; // default: like the source
  channel?: number; // default: the source's
  number?: number; // default: the source's note / CC
  device?: string; // output port; default: the input's name
  // Buttons; default: lit when on / playing / cued / armed. Several messages
  // for one state: e.g. a colour, then a blink against it (APC40, Launchpad)
  states?: Partial<Record<ButtonState, FeedbackMessage | FeedbackMessage[]>>;
  echo?: boolean; // faders: send the value back (LED rings, motor faders)
}

export interface Mapping {
  id: string;
  source: ControlSource;
  target: string; // see targets.ts
  feedback?: Feedback;
  template?: string; // set by a controller template (id)
}

export type Takeover = 'jump' | 'pickup';

interface ControlState {
  mappings: Mapping[];
  takeover: Takeover; // absolute faders: jump to the controller, or wait until it passes the value
  learning: boolean;
  learnTarget: string | null; // the target picked in learn mode
  learned: { target: string; source: string; at: number } | null; // last assignment, for the learn bar
}

const STORAGE_KEY = 'video-mapper-controls';

// ---- Sources --------------------------------------------------------------------------------

/** A key identifying a source ("same control"), device included. */
export const sourceKey = (s: ControlSource): string => {
  switch (s.kind) {
    case 'note': return `note|${s.device}|${s.channel}|${s.note}`;
    case 'cc': return `cc|${s.device}|${s.channel}|${s.cc}`;
    case 'pitchbend': return `pb|${s.device}|${s.channel}`;
    case 'key': return `key|${s.code}|${s.shift ? 1 : 0}|${s.alt ? 1 : 0}`;
  }
};

/** The source a MIDI message comes from (null: not a mappable control). */
export const sourceOfMidi = (device: string, m: MidiMessage): ControlSource | null => {
  switch (m.type) {
    case 'noteon':
    case 'noteoff': return { kind: 'note', device, channel: m.channel, note: m.note };
    case 'cc': return { kind: 'cc', device, channel: m.channel, cc: m.cc };
    case 'pitchbend': return { kind: 'pitchbend', device, channel: m.channel };
    default: return null;
  }
};

const KEY_NAMES: Record<string, string> = { Space: 'Space', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=' };

/** "Q", "Shift+5", "Space" */
export const keyLabel = (code: string, shift?: boolean, alt?: boolean): string => {
  const name = KEY_NAMES[code] ?? code.replace(/^Key|^Digit|^Numpad/, (p) => (p === 'Numpad' ? 'Num ' : ''));
  return `${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${name}`;
};

export const sourceLabel = (s: ControlSource): string => {
  const dev = (d: string) => (d ? `${d} · ` : '');
  switch (s.kind) {
    case 'note': return `${dev(s.device)}Note ${s.note} · ch ${s.channel + 1}`;
    case 'cc': return `${dev(s.device)}CC ${s.cc} · ch ${s.channel + 1}${s.encoding && s.encoding !== 'absolute' ? ' · relative' : ''}`;
    case 'pitchbend': return `${dev(s.device)}Pitch bend · ch ${s.channel + 1}`;
    case 'key': return `Key ${keyLabel(s.code, s.shift, s.alt)}`;
  }
};

/** Does a mapping's source match an incoming one? An empty device matches every device. */
export const sourceMatches = (mapping: ControlSource, incoming: ControlSource): boolean => {
  if (mapping.kind !== incoming.kind) return false;
  if (mapping.kind === 'key' && incoming.kind === 'key') {
    return mapping.code === incoming.code && !!mapping.shift === !!incoming.shift && !!mapping.alt === !!incoming.alt;
  }
  if (mapping.kind === 'key' || incoming.kind === 'key') return false;
  if (mapping.device && mapping.device !== incoming.device) return false;
  if (mapping.channel !== incoming.channel) return false;
  if (mapping.kind === 'note' && incoming.kind === 'note') return mapping.note === incoming.note;
  if (mapping.kind === 'cc' && incoming.kind === 'cc') return mapping.cc === incoming.cc;
  return mapping.kind === 'pitchbend';
};

// ---- Store --------------------------------------------------------------------------------

const isMapping = (m: unknown): m is Mapping => {
  if (!m || typeof m !== 'object') return false;
  const { id, source, target } = m as Mapping;
  return typeof id === 'string' && typeof target === 'string' && !!source && typeof source === 'object' &&
    ['note', 'cc', 'pitchbend', 'key'].includes((source as ControlSource).kind);
};

const load = (): Pick<ControlState, 'mappings' | 'takeover'> => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { mappings?: unknown[]; takeover?: unknown };
    return {
      mappings: Array.isArray(raw.mappings) ? raw.mappings.filter(isMapping) : [],
      takeover: raw.takeover === 'pickup' ? 'pickup' : 'jump',
    };
  } catch {
    return { mappings: [], takeover: 'jump' };
  }
};

export const controlStore = createStore<ControlState>()(() => ({
  ...load(),
  learning: false,
  learnTarget: null,
  learned: null,
}));

export function useControls<T>(selector: (state: ControlState) => T): T {
  return useStore(controlStore, selector);
}

controlStore.subscribe((state, prev) => {
  if (state.mappings === prev.mappings && state.takeover === prev.takeover) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mappings: state.mappings, takeover: state.takeover }));
  } catch {
    // not persisted — still applies now
  }
});

let nextId = 0;
const newId = () => `map-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

/** Assign a source to a target: the source drives only this target from now on. */
export const assign = (source: ControlSource, target: string, feedback?: Feedback): Mapping => {
  const key = sourceKey(source);
  const mapping: Mapping = { id: newId(), source, target, ...(feedback ? { feedback } : {}) };
  controlStore.setState(s => ({ mappings: [...s.mappings.filter(m => sourceKey(m.source) !== key), mapping] }));
  return mapping;
};

export const removeMapping = (id: string): void =>
  controlStore.setState(s => ({ mappings: s.mappings.filter(m => m.id !== id) }));

export const removeMappingsOf = (target: string): void =>
  controlStore.setState(s => ({ mappings: s.mappings.filter(m => m.target !== target) }));

export const updateMapping = (id: string, patch: Partial<Omit<Mapping, 'id'>>): void =>
  controlStore.setState(s => ({ mappings: s.mappings.map(m => (m.id === id ? { ...m, ...patch } : m)) }));

/** Replace everything a template mapped (or add a template's mappings). */
export const setTemplateMappings = (template: string, mappings: Omit<Mapping, 'id' | 'template'>[]): void =>
  controlStore.setState(s => {
    const added = mappings.map(m => ({ ...m, id: newId(), template }));
    const keys = new Set(added.map(m => sourceKey(m.source)));
    return { mappings: [...s.mappings.filter(m => m.template !== template && !keys.has(sourceKey(m.source))), ...added] };
  });

export const clearMappings = (): void => controlStore.setState({ mappings: [] });

export const setTakeover = (takeover: Takeover): void => controlStore.setState({ takeover });

export const removeTemplateMappings = (template: string): void =>
  controlStore.setState(s => ({ mappings: s.mappings.filter(m => m.template !== template) }));
