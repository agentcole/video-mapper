import { projectStore } from '../state/projectStore';
import { liveStore } from '../state/liveStore';
import { controlChange, noteOn } from './midiMessages';
import { controlStore, type FeedbackMessage, type Mapping } from './mappings';
import { buttonState, faderValue, isFader, parseTarget, type ButtonState } from './targets';

// ---------------------------------------------------------------------------
// Controller feedback: LEDs show what their buttons do (playing, cued,
// waiting for the beat …), encoder rings and motor faders follow their
// values. Only changes are sent; a reconnected controller gets everything.
// Runs on store changes, not on a timer, so it keeps up while the editor
// window is hidden.
// ---------------------------------------------------------------------------

export interface FeedbackOut {
  key: string; // one LED / ring: device | type | channel | number
  device: string;
  messages: number[][];
}

// Without a template: lit when something is on, playing, cued or waiting
const LIT: ReadonlySet<ButtonState> = new Set(['on', 'playing', 'cued', 'armed']);

// A template that doesn't name a state falls back like this
const FALLBACK: Record<ButtonState, ButtonState | null> = {
  playing: 'on', armed: 'on', cued: 'on', on: null, available: 'off', off: null,
};

type States = Partial<Record<ButtonState, FeedbackMessage | FeedbackMessage[]>>;

const stateMessages = (states: States, state: ButtonState): FeedbackMessage[] => {
  for (let s: ButtonState | null = state; s; s = FALLBACK[s]) {
    const message = states[s];
    if (message) return Array.isArray(message) ? message : [message];
  }
  const off = states.off ?? { value: 0 };
  return Array.isArray(off) ? off : [off];
};

/** What every mapped control should show now. */
export const computeFeedback = (mappings: readonly Mapping[]): FeedbackOut[] => {
  const out = new Map<string, FeedbackOut>();
  for (const mapping of mappings) {
    const { source } = mapping;
    if (source.kind === 'key') continue;
    const target = parseTarget(mapping.target);
    if (!target) continue;
    const fb = mapping.feedback ?? {};
    const device = fb.device ?? source.device;
    if (!device) continue; // "any device" mappings have nowhere to send to
    const type = fb.type ?? (source.kind === 'note' ? 'note' : source.kind === 'cc' ? 'cc' : null);
    if (!type) continue;
    const number = fb.number ?? (source.kind === 'note' ? source.note : source.kind === 'cc' ? source.cc : 0);
    const channel = fb.channel ?? source.channel;
    const key = `${device}|${type}|${channel}|${number}`;

    if (isFader(target)) {
      if (!fb.echo) continue;
      const value = Math.round((faderValue(target) ?? 0) * 127);
      out.set(key, { key, device, messages: [type === 'note' ? noteOn(channel, number, value) : controlChange(channel, number, value)] });
      continue;
    }
    const state = buttonState(target);
    const messages = fb.states ? stateMessages(fb.states, state) : [{ value: LIT.has(state) ? 127 : 0 }];
    out.set(key, {
      key,
      device,
      messages: messages.map(m => {
        const ch = m.channel ?? channel;
        return type === 'note' ? noteOn(ch, number, m.value) : controlChange(ch, number, m.value);
      }),
    });
  }
  return [...out.values()];
};

// ---- Sending ------------------------------------------------------------------------------

type Sender = (device: string, bytes: number[]) => boolean;

let sender: Sender | null = null;
const sent = new Map<string, string>(); // key → bytes last sent
let pending = false;
let unsubscribe: (() => void) | null = null;

const flush = () => {
  pending = false;
  if (!sender) return;
  for (const { key, device, messages } of computeFeedback(controlStore.getState().mappings)) {
    const text = messages.join(';');
    if (sent.get(key) === text) continue;
    if (messages.every(bytes => sender!(device, bytes))) sent.set(key, text);
  }
};

const schedule = () => {
  if (pending) return;
  pending = true;
  queueMicrotask(flush);
};

/** Start sending feedback through `send` (returns false when the device has no output). */
export const startFeedback = (send: Sender): void => {
  sender = send;
  sent.clear();
  unsubscribe?.();
  const subs = [projectStore.subscribe(schedule), liveStore.subscribe(schedule), controlStore.subscribe(schedule)];
  unsubscribe = () => subs.forEach(u => u());
  schedule();
};

export const stopFeedback = (): void => {
  unsubscribe?.();
  unsubscribe = null;
  sender = null;
  sent.clear();
};

/** Send everything again (a controller (re)connected, a template set its colours). */
export const resendFeedback = (): void => {
  sent.clear();
  schedule();
};
