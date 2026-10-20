import type { Feedback, FeedbackMessage, Mapping } from './mappings';
import type { ButtonState } from './targets';

// ---------------------------------------------------------------------------
// Controller templates: ready-made mappings with LED colours for common
// controllers, built from the manufacturers' MIDI documentation (sources in
// docs/design/midi.md). Not tested on the hardware yet.
//
// Layout everywhere: grid rows are launcher layers from the top, grid
// columns are launcher columns. Faders drive layer opacity (or macros),
// the master fader the master.
// ---------------------------------------------------------------------------

type TemplateMapping = Omit<Mapping, 'id' | 'template'>;

export interface ControllerTemplate {
  id: string;
  name: string;
  match: RegExp; // input port names it is for
  note: string; // what it maps, what to know
  sysex?: number[]; // switches the controller into the mode the template needs (SysEx permission)
  init?: number[][]; // sent when applied (e.g. encoder colours)
  mappings: (device: string) => TemplateMapping[];
}

// The colour palette Akai (APC mini mk2, APC40 mkII) and Novation (Launchpad) share
const COLOUR = { off: 0, dim: 1, white: 3, red: 5, amber: 9, yellow: 13, green: 21, cyan: 37, blue: 45, purple: 49 };

type States = Partial<Record<ButtonState, FeedbackMessage | FeedbackMessage[]>>;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const note = (device: string, channel: number, n: number, target: string, feedback?: Feedback): TemplateMapping => ({
  source: { kind: 'note', device, channel, note: n }, target, ...(feedback ? { feedback } : {}),
});

const cc = (device: string, channel: number, n: number, target: string, feedback?: Feedback): TemplateMapping => ({
  source: { kind: 'cc', device, channel, cc: n }, target, ...(feedback ? { feedback } : {}),
});

// ---- Akai APC mini mk2 ----------------------------------------------------------------------
// Pads: note = row from the bottom × 8 + column (0 = bottom left), velocity =
// colour, channel = brightness (6 = 100 %) / pulse (7–10) / blink (11–15).

const APC_MINI_PAD: States = {
  off: { channel: 0, value: COLOUR.off },
  available: { channel: 6, value: COLOUR.dim },
  playing: { channel: 6, value: COLOUR.green },
  cued: { channel: 6, value: COLOUR.amber },
  armed: { channel: 14, value: COLOUR.amber }, // blink 1/4
};
// Track and scene buttons: one colour, 0 off / 1 on / 2 blink
const APC_SINGLE: States = { off: { value: 0 }, available: { value: 0 }, on: { value: 1 }, cued: { value: 1 }, playing: { value: 1 }, armed: { value: 2 } };
const APC_SINGLE_LIT: States = { ...APC_SINGLE, available: { value: 1 } };

const apcMini: ControllerTemplate = {
  id: 'apc-mini-mk2',
  name: 'Akai APC mini mk2',
  match: /apc mini mk2/i,
  note: 'Pads: 8 layers × 8 columns. Buttons under the pads: play a column. Buttons on the right: clear that layer. Faders 1–8: layer opacity, fader 9: master.',
  mappings: (d) => [
    ...range(8).flatMap(row => range(8).map(column =>
      note(d, 0, (7 - row) * 8 + column, `slot:${row}:${column}`, { states: APC_MINI_PAD }))),
    ...range(8).map(column => note(d, 0, 100 + column, `column:${column}`, { states: APC_SINGLE })),
    ...range(8).map(row => note(d, 0, 112 + row, `clear:${row}`, { states: APC_SINGLE_LIT })),
    ...range(8).map(row => cc(d, 0, 48 + row, `opacity:${row}`)),
    cc(d, 0, 56, 'master'),
  ],
};

// ---- Novation Launchpad Mini MK3 / Launchpad X (programmer mode) ---------------------------------
// Pads: note = 10 × row from the bottom + column (11 = bottom left, 88 = top
// right); top row CC 91–98, right column CC 89 … 19. Channel 0 static,
// 1 flashing (against the static colour), 2 pulsing.

const LP_PAD: States = {
  off: { channel: 0, value: COLOUR.off },
  available: { channel: 0, value: COLOUR.dim },
  playing: { channel: 0, value: COLOUR.green },
  cued: { channel: 0, value: COLOUR.amber },
  on: { channel: 0, value: COLOUR.white },
  armed: [{ channel: 0, value: COLOUR.off }, { channel: 1, value: COLOUR.amber }],
};
const LP_BUTTON: States = { ...LP_PAD, available: { channel: 0, value: COLOUR.dim } };

const launchpad = (id: string, name: string, match: RegExp, model: number): ControllerTemplate => ({
  id,
  name,
  match,
  note: 'Programmer mode (switched on by the template — needs SysEx access). Pads: 8 layers × 8 columns. Top row: play a column. Right column: clear that layer. Use the “MIDI” port, not “DAW”.',
  sysex: [0xf0, 0x00, 0x20, 0x29, 0x02, model, 0x0e, 0x01, 0xf7],
  mappings: (d) => [
    ...range(8).flatMap(row => range(8).map(column =>
      note(d, 0, (8 - row) * 10 + column + 1, `slot:${row}:${column}`, { states: LP_PAD }))),
    ...range(8).map(column => cc(d, 0, 91 + column, `column:${column}`, { states: LP_BUTTON })),
    ...range(8).map(row => cc(d, 0, 89 - row * 10, `clear:${row}`, { states: { ...LP_BUTTON, available: { channel: 0, value: COLOUR.red } } })),
  ],
});

// ---- DJ TechTools Midi Fighter Twister ------------------------------------------------------------
// Bank 1: encoders CC 0–15 on channel 0 (absolute), push switches the same
// CC on channel 1; ring = value on channel 0, colour = hue (1–125) on channel 1.

const TWISTER_HUE = { macro: 25, opacity: 45, crossfader: 64, master: 100, blackout: 85 };

const twister: ControllerTemplate = {
  id: 'midi-fighter-twister',
  name: 'DJ TechTools Midi Fighter Twister',
  match: /midi fighter twister/i,
  note: 'Bank 1. Rows 1–2: macros 1–8. Row 3 and the first two of row 4: opacity of layers 1–6. Encoder 15: crossfader, encoder 16: master (push: blackout). Rings follow the values.',
  init: [
    ...range(8).map(i => [0xb1, i, TWISTER_HUE.macro]),
    ...range(6).map(i => [0xb1, 8 + i, TWISTER_HUE.opacity]),
    [0xb1, 14, TWISTER_HUE.crossfader],
    [0xb1, 15, TWISTER_HUE.master],
  ],
  mappings: (d) => [
    ...range(8).map(i => cc(d, 0, i, `macro:${i}`, { echo: true })),
    ...range(6).map(row => cc(d, 0, 8 + row, `opacity:${row}`, { echo: true })),
    cc(d, 0, 14, 'crossfader', { echo: true }),
    cc(d, 0, 15, 'master', { echo: true }),
    // Push on the master encoder: blackout (the encoder turns red)
    cc(d, 1, 15, 'blackout', { states: { off: { value: TWISTER_HUE.master }, on: { value: TWISTER_HUE.blackout } } }),
  ],
};

// ---- Korg nanoKONTROL2 (CC mode) -------------------------------------------------------------------
// Everything is CC on channel 0. LEDs light from the host only with "LED
// Mode: External" (Korg Kontrol Editor) — 127 on / 0 off on the button's CC.

const nanoKontrol: ControllerTemplate = {
  id: 'nanokontrol2',
  name: 'Korg nanoKONTROL2',
  match: /nanokontrol2/i,
  note: 'Faders: opacity of layers 1–8. Knobs: macros 1–8. S: play a column, M: clear a layer, R: cue a column. ▶ Go, ■ Clear all, ● Blackout, Cycle: tap, ◀◀ ▶▶ nudge, Track ◀ ▶ ÷2 ×2, Marker Set: resync. For the LEDs set LED Mode to External in the Korg Kontrol Editor.',
  mappings: (d) => [
    ...range(8).map(row => cc(d, 0, row, `opacity:${row}`)),
    ...range(8).map(i => cc(d, 0, 16 + i, `macro:${i}`)),
    ...range(8).map(column => cc(d, 0, 32 + column, `column:${column}`)),
    ...range(8).map(row => cc(d, 0, 48 + row, `clear:${row}`)),
    ...range(8).map(column => cc(d, 0, 64 + column, `cue:${column}`)),
    cc(d, 0, 41, 'go'),
    cc(d, 0, 42, 'clear-all'),
    cc(d, 0, 45, 'blackout'),
    cc(d, 0, 46, 'tap'),
    cc(d, 0, 43, 'nudge:-1'),
    cc(d, 0, 44, 'nudge:1'),
    cc(d, 0, 58, 'tempo-half'),
    cc(d, 0, 59, 'tempo-double'),
    cc(d, 0, 60, 'resync'),
  ],
};

// ---- Akai APC40 mkII (Alternate mode) ----------------------------------------------------------------
// Pads: notes 0–39 on channel 0 (0 = bottom left, top row 32–39), colour =
// velocity on channel 0; blinking: colour on channel 0, then the blink
// colour on 11–15. Clip Stop: note 52 with channel = track.

const APC40_PAD: States = {
  off: { channel: 0, value: COLOUR.off },
  available: { channel: 0, value: COLOUR.dim },
  playing: { channel: 0, value: COLOUR.green },
  cued: { channel: 0, value: COLOUR.amber },
  armed: [{ channel: 0, value: COLOUR.amber }, { channel: 14, value: COLOUR.off }], // amber / black, 1/4
};

const apc40: ControllerTemplate = {
  id: 'apc40-mk2',
  name: 'Akai APC40 mkII',
  match: /apc40 mkii/i,
  note: 'Switched to Alternate mode (needs SysEx access). Pads: 5 layers × 8 columns. Clip Stop: play that column. Scene buttons: clear that layer, Stop All: clear all. Track faders: opacity of layers 1–8, master and crossfader as labelled. Track knobs: macros 1–8. Play: Go, Record: blackout, Tap Tempo, Nudge −/+.',
  sysex: [0xf0, 0x47, 0x7f, 0x29, 0x60, 0x00, 0x04, 0x42, 0x00, 0x00, 0x00, 0xf7],
  mappings: (d) => [
    ...range(5).flatMap(row => range(8).map(column =>
      note(d, 0, (4 - row) * 8 + column, `slot:${row}:${column}`, { states: APC40_PAD }))),
    ...range(8).map(column => note(d, column, 52, `column:${column}`, { states: APC_SINGLE })),
    ...range(5).map(row => note(d, 0, 82 + row, `clear:${row}`, { states: APC40_PAD })),
    note(d, 0, 81, 'clear-all'),
    ...range(8).map(track => cc(d, track, 7, `opacity:${track}`)),
    cc(d, 0, 14, 'master'),
    cc(d, 0, 15, 'crossfader'),
    ...range(8).map(i => cc(d, 0, 48 + i, `macro:${i}`, { echo: true })),
    note(d, 0, 91, 'go'),
    note(d, 0, 93, 'blackout'),
    note(d, 0, 99, 'tap'),
    note(d, 0, 100, 'nudge:-1'),
    note(d, 0, 101, 'nudge:1'),
  ],
};

export const TEMPLATES: ControllerTemplate[] = [
  apcMini,
  launchpad('launchpad-mini-mk3', 'Novation Launchpad Mini MK3', /lpminimk3 midi|launchpad mini mk3(?!.*daw)/i, 0x0d),
  launchpad('launchpad-x', 'Novation Launchpad X', /lpx midi|launchpad x(?!.*daw)/i, 0x0c),
  twister,
  nanoKontrol,
  apc40,
];

/** Templates for an input port (by its name). */
export const templatesFor = (inputName: string): ControllerTemplate[] =>
  TEMPLATES.filter(t => t.match.test(inputName) && !/daw/i.test(inputName));
