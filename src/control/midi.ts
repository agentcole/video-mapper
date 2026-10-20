import { createStore, useStore } from 'zustand';
import { describeMidi, parseMidi, type MidiMessage } from './midiMessages';
import { handleMidi, resetEngine } from './engine';
import { resendFeedback, startFeedback, stopFeedback } from './feedback';
import { ClockFollower, TICKS_PER_BEAT } from './midiClock';
import { followExternalClock } from '../state/clockActions';
import { setTemplateMappings } from './mappings';
import type { ControllerTemplate } from './templates';

// ---------------------------------------------------------------------------
// Web MIDI in the editor: access (one permission prompt; SysEx only when a
// template needs it), the ports, messages → mappings / learn, LED feedback
// out, and following a MIDI clock. MIDI events arrive while the editor
// window is hidden too — nothing here waits for a timer or a frame.
// ---------------------------------------------------------------------------

export type MidiStatus = 'off' | 'requesting' | 'on' | 'unsupported' | 'denied' | 'error';

export interface MidiPort {
  id: string;
  name: string;
  connected: boolean;
}

interface MidiState {
  status: MidiStatus;
  error: string | null;
  sysex: boolean; // SysEx access granted (Launchpad / APC40 modes)
  inputs: MidiPort[];
  outputs: MidiPort[];
  activity: { device: string; label: string; at: number } | null; // last message, for the indicator
  clockInput: string | null; // follow the MIDI clock of this input
  clockSources: string[]; // inputs that sent a clock lately
  clock: { bpm: number | null; running: boolean } | null; // the followed clock
}

const SETTINGS_KEY = 'video-mapper-midi';

interface MidiSettings {
  enabled: boolean;
  sysex: boolean;
  clockInput: string | null;
}

const loadSettings = (): MidiSettings => {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<MidiSettings>;
    return {
      enabled: raw.enabled === true,
      sysex: raw.sysex === true,
      clockInput: typeof raw.clockInput === 'string' ? raw.clockInput : null,
    };
  } catch {
    return { enabled: false, sysex: false, clockInput: null };
  }
};

let settings = loadSettings();

const saveSettings = (patch: Partial<MidiSettings>) => {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // not persisted
  }
};

export const midiStore = createStore<MidiState>()(() => ({
  status: 'off',
  error: null,
  sysex: false,
  inputs: [],
  outputs: [],
  activity: null,
  clockInput: settings.clockInput,
  clockSources: [],
  clock: null,
}));

export function useMidi<T>(selector: (state: MidiState) => T): T {
  return useStore(midiStore, selector);
}

let access: MIDIAccess | null = null;

const portsOf = (map: MIDIInputMap | MIDIOutputMap): MidiPort[] =>
  [...map.values()].map(p => ({ id: p.id, name: p.name ?? p.id, connected: p.state === 'connected' }));

// ---- Messages -------------------------------------------------------------------------

let follower = new ClockFollower();
let clockTicks = 0;
let lastActivity = 0;
const clockSeen = new Map<string, number>(); // input → last clock tick (ms)

const onClock = (device: string, m: MidiMessage, time: number) => {
  const now = performance.now();
  if (!clockSeen.has(device) || now - (clockSeen.get(device) ?? 0) > 1000) {
    clockSeen.set(device, now);
    const sources = [...clockSeen].filter(([, t]) => now - t < 3000).map(([d]) => d);
    if (sources.join('|') !== midiStore.getState().clockSources.join('|')) midiStore.setState({ clockSources: sources });
  }
  if (device !== midiStore.getState().clockInput) return;
  switch (m.type) {
    case 'clock': follower.tick(time); clockTicks++; break;
    case 'start': follower.start(); clockTicks = 0; break;
    case 'continue': follower.continue(); break;
    case 'stop': follower.stop(); break;
    case 'songposition': follower.songPosition(m.sixteenths); break;
  }
  // Each beat (and right after Start) the master clock follows: tempo, and
  // the bar while the song runs
  if (m.type !== 'clock' || clockTicks % TICKS_PER_BEAT === 1) {
    const external = follower.clock();
    if (external) followExternalClock(external.bpm, follower.running ? external.origin : null);
    midiStore.setState({ clock: { bpm: external?.bpm ?? null, running: follower.running } });
  }
};

const onMessage = (device: string, event: MIDIMessageEvent) => {
  if (!event.data) return;
  const m = parseMidi(event.data);
  const time = performance.timeOrigin + event.timeStamp;
  if (m.type === 'clock' || m.type === 'start' || m.type === 'continue' || m.type === 'stop' || m.type === 'songposition') {
    onClock(device, m, time);
    return;
  }
  if (m.type === 'other') return;
  handleMidi(device, m);
  const now = performance.now();
  if (now - lastActivity > 80) {
    lastActivity = now;
    midiStore.setState({ activity: { device, label: describeMidi(m), at: now } });
  }
};

const attach = () => {
  if (!access) return;
  for (const input of access.inputs.values()) {
    const name = input.name ?? input.id;
    input.onmidimessage = (event) => onMessage(name, event);
  }
  midiStore.setState({ inputs: portsOf(access.inputs), outputs: portsOf(access.outputs) });
};

/**
 * A port name without its direction: controllers name their ports
 * "… MIDI Out" / "… MIDI In", "MIDIIN2 (…)" / "MIDIOUT2 (…)" or
 * "nanoKONTROL2 SLIDER/KNOB" / "nanoKONTROL2 CTRL".
 */
export const portKey = (name: string): string =>
  name.toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\b(?:midi)?(?:in|out)\d*\b/g, ' ')
    .replace(/\b(?:slider\/knob|ctrl)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The output that belongs to an input: same name, or the same device by its port name. */
const outputFor = (device: string): MIDIOutput | null => {
  if (!access) return null;
  const outputs = [...access.outputs.values()].filter(o => o.state === 'connected');
  const exact = outputs.find(o => (o.name ?? o.id) === device);
  if (exact) return exact;
  const key = portKey(device);
  const same = outputs.filter(o => portKey(o.name ?? o.id) === key);
  return same.length === 1 ? same[0] : null;
};

/** Send to an output by name (or the input's own output); false when there is none. */
export const sendMidi = (device: string, bytes: number[]): boolean => {
  const output = outputFor(device);
  if (!output) return false;
  try {
    output.send(bytes);
    return true;
  } catch {
    return false; // SysEx without permission, or the port just went away
  }
};

// ---- Access -------------------------------------------------------------------------------

const describeError = (error: unknown): { status: MidiStatus; message: string } => {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { status: 'denied', message: 'MIDI access was denied — allow it in the browser’s site settings.' };
  }
  return { status: 'error', message: (error as Error)?.message || 'MIDI could not be started.' };
};

/** Ask for MIDI access (a permission prompt the first time). SysEx: for templates that switch controller modes. */
export const enableMidi = async (sysex = settings.sysex): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    midiStore.setState({ status: 'unsupported', error: 'This browser has no Web MIDI (use Chrome or Edge).' });
    return;
  }
  midiStore.setState({ status: 'requesting', error: null });
  try {
    const next = await navigator.requestMIDIAccess({ sysex });
    if (access) for (const input of access.inputs.values()) input.onmidimessage = null;
    access = next;
    access.onstatechange = () => {
      attach();
      resendFeedback(); // a controller plugged in gets its LEDs
    };
    attach();
    startFeedback(sendMidi);
    saveSettings({ enabled: true, sysex });
    midiStore.setState({ status: 'on', sysex });
  } catch (error) {
    const { status, message } = describeError(error);
    midiStore.setState({ status, error: message });
  }
};

export const disableMidi = (): void => {
  if (access) {
    for (const input of access.inputs.values()) input.onmidimessage = null;
    access.onstatechange = null;
  }
  access = null;
  stopFeedback();
  resetEngine();
  saveSettings({ enabled: false });
  midiStore.setState({ status: 'off', error: null, inputs: [], outputs: [], activity: null, clock: null });
};

/** On load: turn MIDI back on if it was on and the permission is still there (no prompt). */
export const resumeMidi = async (): Promise<void> => {
  if (!settings.enabled || access || typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return;
  try {
    const status = await navigator.permissions?.query({ name: 'midi', sysex: settings.sysex } as unknown as PermissionDescriptor);
    if (status && status.state !== 'granted') return;
  } catch {
    // no permissions API for MIDI here — ask anyway (it was on last time)
  }
  await enableMidi();
};

/** Follow the MIDI clock of this input (null: off). */
export const setClockInput = (device: string | null): void => {
  saveSettings({ clockInput: device });
  follower = new ClockFollower();
  clockTicks = 0;
  midiStore.setState({ clockInput: device, clock: null });
};

/** Send SysEx (controller mode switches); needs SysEx access. */
export const sendSysex = (device: string, bytes: number[]): boolean => (midiStore.getState().sysex ? sendMidi(device, bytes) : false);

/**
 * Set up a controller with a template: SysEx mode switch first (asking for
 * SysEx access if needed), then its setup messages, then the mappings —
 * whose feedback lights the LEDs. Returns an error to show, or null.
 */
export const applyTemplate = async (template: ControllerTemplate, device: string): Promise<string | null> => {
  if (template.sysex) {
    if (!midiStore.getState().sysex) await enableMidi(true);
    if (!midiStore.getState().sysex) return 'This template needs SysEx access to switch the controller’s mode — allow it when the browser asks.';
    if (!sendSysex(device, template.sysex)) return `Could not reach the output of “${device}”.`;
  }
  for (const bytes of template.init ?? []) sendMidi(device, bytes);
  resetEngine();
  setTemplateMappings(template.id, template.mappings(device));
  resendFeedback();
  return null;
};
