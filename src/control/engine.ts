import { relativeSteps, type MidiMessage } from './midiMessages';
import {
  assign, controlStore, removeMappingsOf, sourceLabel, sourceMatches, sourceOfMidi, type ControlSource, type Mapping,
} from './mappings';
import { faderValue, isFader, parseTarget, pressTarget, setFader, type ControlTarget } from './targets';

// ---------------------------------------------------------------------------
// Runs mappings: a MIDI message or key press drives its targets, or — in
// learn mode — becomes the mapping of the picked target. Faders take
// absolute values (with optional pickup), relative encoder steps and pitch
// bend; buttons press and release (piano clips, nudge are held).
// ---------------------------------------------------------------------------

// One encoder step moves a fader by this much (128 steps for the whole range)
export const RELATIVE_STEP = 1 / 128;
// Pickup: the controller catches the value when it comes this close (or passes it)
const PICKUP_WINDOW = 0.02;

const releases = new Map<string, () => void>(); // mapping id → release of a held button
const lastPosition = new Map<string, number>(); // mapping id → last controller position (0..1)
const pickups = new Map<string, { caught: boolean; lastSet?: number }>();

/** Forget held buttons and fader positions (mappings changed, MIDI restarted). */
export const resetEngine = (): void => {
  releases.forEach(release => release());
  releases.clear();
  lastPosition.clear();
  pickups.clear();
};

// ---- Learn mode ------------------------------------------------------------------------------

export const startLearning = (): void => controlStore.setState({ learning: true, learnTarget: null, learned: null });

export const stopLearning = (): void => controlStore.setState({ learning: false, learnTarget: null });

export const toggleLearning = (): void => (controlStore.getState().learning ? stopLearning() : startLearning());

/** Pick the target the next control is assigned to (learn mode). */
export const pickLearnTarget = (target: string | null): void => controlStore.setState({ learnTarget: target, learned: null });

/** Can this message be learned for this target? Faders want a continuous control, buttons a press. */
const learnable = (target: ControlTarget, m: MidiMessage): boolean =>
  isFader(target) ? m.type === 'cc' || m.type === 'pitchbend' : m.type === 'noteon' || (m.type === 'cc' && m.value > 0);

const learn = (source: ControlSource) => {
  const { learnTarget } = controlStore.getState();
  if (!learnTarget) return;
  assign(source, learnTarget);
  resetEngine();
  controlStore.setState({ learnTarget: null, learned: { target: learnTarget, source: sourceLabel(source), at: Date.now() } });
};

// ---- Applying -----------------------------------------------------------------------------------

const absolute = (mapping: Mapping, target: ControlTarget, position: number) => {
  const current = faderValue(target);
  if (current === null) return;
  const previous = lastPosition.get(mapping.id);
  lastPosition.set(mapping.id, position);
  if (controlStore.getState().takeover === 'jump') {
    setFader(target, position);
    return;
  }
  const pickup = pickups.get(mapping.id) ?? { caught: false };
  // Moved elsewhere (mouse, another control) since we set it: catch it again
  if (pickup.lastSet !== undefined && Math.abs(current - pickup.lastSet) > 0.01) pickup.caught = false;
  if (!pickup.caught) {
    const passed = previous !== undefined && (previous - current) * (position - current) <= 0;
    pickup.caught = Math.abs(position - current) <= PICKUP_WINDOW || passed;
  }
  if (pickup.caught) {
    setFader(target, position);
    pickup.lastSet = position;
  }
  pickups.set(mapping.id, pickup);
};

const press = (mapping: Mapping, target: ControlTarget) => {
  releases.get(mapping.id)?.();
  releases.delete(mapping.id);
  const release = pressTarget(target);
  if (release) releases.set(mapping.id, release);
};

const release = (mapping: Mapping) => {
  releases.get(mapping.id)?.();
  releases.delete(mapping.id);
};

const applyMidi = (mapping: Mapping, m: MidiMessage) => {
  const target = parseTarget(mapping.target);
  if (!target) return;
  if (isFader(target)) {
    if (m.type === 'cc') {
      const encoding = mapping.source.kind === 'cc' ? mapping.source.encoding ?? 'absolute' : 'absolute';
      if (encoding === 'absolute') {
        absolute(mapping, target, m.value / 127);
      } else {
        const current = faderValue(target);
        if (current !== null) setFader(target, current + relativeSteps(encoding, m.value) * RELATIVE_STEP);
      }
    } else if (m.type === 'pitchbend') {
      absolute(mapping, target, m.value / 16383);
    } else if (m.type === 'noteon') {
      setFader(target, m.velocity / 127); // a pad sets the level it was hit with
    }
    return;
  }
  // Buttons: note on/off, or a CC crossing the middle (127 / 0)
  if (m.type === 'noteon') press(mapping, target);
  else if (m.type === 'noteoff') release(mapping);
  else if (m.type === 'cc') {
    const was = (lastPosition.get(mapping.id) ?? 0) >= 0.5;
    const is = m.value >= 64;
    lastPosition.set(mapping.id, m.value / 127);
    if (is && !was) press(mapping, target);
    else if (!is && was) release(mapping);
  }
};

/** A message from a MIDI input. Returns true when it was used (learned or mapped). */
export const handleMidi = (device: string, m: MidiMessage): boolean => {
  const source = sourceOfMidi(device, m);
  if (!source) return false;
  const { learning, learnTarget, mappings } = controlStore.getState();
  if (learning) {
    const target = learnTarget ? parseTarget(learnTarget) : null;
    if (target && learnable(target, m)) {
      learn(source);
      return true;
    }
    return false;
  }
  let used = false;
  for (const mapping of mappings) {
    if (sourceMatches(mapping.source, source)) {
      applyMidi(mapping, m);
      used = true;
    }
  }
  return used;
};

// ---- Keys ------------------------------------------------------------------------------------------

const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'CapsLock']);

const keySource = (e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'altKey'>): ControlSource => ({
  kind: 'key', code: e.code, ...(e.shiftKey ? { shift: true } : {}), ...(e.altKey ? { alt: true } : {}),
});

/**
 * A key went down (not while typing; the caller checks). Learn mode assigns
 * it (Delete removes the picked target's mappings); otherwise mapped keys
 * run their targets. Returns true when the key was used.
 */
export const handleKeyDown = (e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'altKey' | 'metaKey' | 'ctrlKey' | 'repeat'>): boolean => {
  if (e.metaKey || e.ctrlKey || MODIFIERS.has(e.code)) return false;
  const { learning, learnTarget, mappings } = controlStore.getState();
  if (learning) {
    if (!learnTarget || e.code === 'Escape') return false;
    if (e.code === 'Delete' || e.code === 'Backspace') {
      removeMappingsOf(learnTarget);
      controlStore.setState({ learnTarget: null, learned: { target: learnTarget, source: '', at: Date.now() } });
      return true;
    }
    learn(keySource(e));
    return true;
  }
  const source = keySource(e);
  const matched = mappings.filter(m => sourceMatches(m.source, source));
  if (matched.length === 0) return false;
  if (e.repeat) return true;
  for (const mapping of matched) {
    const target = parseTarget(mapping.target);
    if (!target) continue;
    if (isFader(target)) setFader(target, (faderValue(target) ?? 0) >= 0.5 ? 0 : 1); // a key toggles a fader
    else press(mapping, target);
  }
  return true;
};

/** A key went up: held buttons (piano clips, nudge) let go — whatever modifiers are up by now. */
export const handleKeyUp = (e: Pick<KeyboardEvent, 'code'>): void => {
  for (const mapping of controlStore.getState().mappings) {
    if (mapping.source.kind === 'key' && mapping.source.code === e.code) release(mapping);
  }
};
