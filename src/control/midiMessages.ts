// ---------------------------------------------------------------------------
// MIDI messages (pure): parse the bytes Web MIDI delivers, build the ones we
// send. Channels are 0–15 here and shown as 1–16.
// ---------------------------------------------------------------------------

export type MidiMessage =
  | { type: 'noteon'; channel: number; note: number; velocity: number }
  | { type: 'noteoff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; cc: number; value: number }
  | { type: 'pitchbend'; channel: number; value: number } // 0..16383, centre 8192
  | { type: 'clock' }
  | { type: 'start' }
  | { type: 'continue' }
  | { type: 'stop' }
  | { type: 'songposition'; sixteenths: number } // MIDI beats (a 16th note = 6 clocks)
  | { type: 'other' };

/** Parse one MIDI message (Web MIDI delivers whole messages). */
export const parseMidi = (data: ArrayLike<number>): MidiMessage => {
  const status = data[0] ?? 0;
  if (status >= 0xf0) {
    switch (status) {
      case 0xf8: return { type: 'clock' };
      case 0xfa: return { type: 'start' };
      case 0xfb: return { type: 'continue' };
      case 0xfc: return { type: 'stop' };
      case 0xf2: return { type: 'songposition', sixteenths: ((data[2] ?? 0) << 7) | (data[1] ?? 0) };
      default: return { type: 'other' };
    }
  }
  const channel = status & 0x0f;
  const a = (data[1] ?? 0) & 0x7f;
  const b = (data[2] ?? 0) & 0x7f;
  switch (status & 0xf0) {
    // A note-on with velocity 0 is a note-off (running status senders use it)
    case 0x90: return b > 0 ? { type: 'noteon', channel, note: a, velocity: b } : { type: 'noteoff', channel, note: a, velocity: 0 };
    case 0x80: return { type: 'noteoff', channel, note: a, velocity: b };
    case 0xb0: return { type: 'cc', channel, cc: a, value: b };
    case 0xe0: return { type: 'pitchbend', channel, value: (b << 7) | a };
    default: return { type: 'other' };
  }
};

export const noteOn = (channel: number, note: number, velocity: number): number[] =>
  [0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f];

export const controlChange = (channel: number, cc: number, value: number): number[] =>
  [0xb0 | (channel & 0x0f), cc & 0x7f, value & 0x7f];

// ---- Relative encoders ------------------------------------------------------------------

// How an endless encoder reports a turn in a CC value
export type CcEncoding = 'absolute' | 'relative-offset' | 'relative-twos' | 'relative-sign';

export const CC_ENCODINGS: { encoding: CcEncoding; label: string }[] = [
  { encoding: 'absolute', label: 'Absolute (0–127)' },
  { encoding: 'relative-offset', label: 'Relative (64 ± n)' },
  { encoding: 'relative-twos', label: 'Relative (1 / 127)' },
  { encoding: 'relative-sign', label: 'Relative (sign bit)' },
];

/** The steps an encoder turned (negative: down) for a relative CC value. */
export const relativeSteps = (encoding: Exclude<CcEncoding, 'absolute'>, value: number): number => {
  switch (encoding) {
    case 'relative-offset': return value - 64; // 65 = +1, 63 = -1
    case 'relative-twos': return value < 64 ? value : value - 128; // 1 = +1, 127 = -1
    case 'relative-sign': return value < 64 ? value : -(value - 64); // 1 = +1, 65 = -1
  }
};

/** "Note 36 · ch 1", "CC 7 · ch 2", "Pitch bend · ch 1" */
export const describeMidi = (m: MidiMessage): string => {
  switch (m.type) {
    case 'noteon':
    case 'noteoff': return `Note ${m.note} · ch ${m.channel + 1}`;
    case 'cc': return `CC ${m.cc} · ch ${m.channel + 1}`;
    case 'pitchbend': return `Pitch bend · ch ${m.channel + 1}`;
    default: return m.type;
  }
};
