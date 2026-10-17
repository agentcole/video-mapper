import { beforeEach, describe, expect, it } from 'vitest';
import { projectStore } from '../state/projectStore';
import { liveStore } from '../state/liveStore';
import { createClip, createColumns, type Layer } from '../state/showModel';
import { DEFAULT_MACROS } from '../lib/defaults';
import { controlChange, noteOn, parseMidi, relativeSteps } from './midiMessages';
import { buttonState, faderValue, parseTarget, pressTarget, setFader, targetId, targetLabel } from './targets';
import { assign, clearMappings, controlStore, setTakeover, setTemplateMappings, sourceLabel } from './mappings';
import { handleKeyDown, handleKeyUp, handleMidi, pickLearnTarget, resetEngine, startLearning, stopLearning } from './engine';
import { computeFeedback } from './feedback';

const DEV = 'Test Controller';

const layer = (id: string, clips: (string | null)[]): Layer => ({
  id, name: id, opacity: 1, blendMode: 'normal', activeClipId: null,
  slots: [...clips.map(c => (c ? createClip(c, { type: 'video', url: `blob:${c}` }) : null)), ...Array(8 - clips.length).fill(null)],
});

const midi = (bytes: number[]) => handleMidi(DEV, parseMidi(bytes));
const key = (code: string, extra: Partial<KeyboardEvent> = {}) =>
  handleKeyDown({ code, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, repeat: false, ...extra });

beforeEach(() => {
  // Layers without surfaces: the last one is on top (row 0)
  projectStore.getState().replaceDocument({
    columns: createColumns(),
    layers: [layer('bottom', ['b1', 'b2']), layer('top', ['t1', null, 't3'])],
    surfaces: [],
    effects: [],
    macros: DEFAULT_MACROS,
  });
  projectStore.getState().setTempo(t => ({ ...t, beatSnap: 'off' }));
  liveStore.setState({ scheduled: [], cuedColumn: null, blackout: false, masterOpacity: 1, crossfader: 0.5 });
  clearMappings();
  setTakeover('jump');
  stopLearning();
  resetEngine();
});

const active = (id: string) => projectStore.getState().layers.find(l => l.id === id)?.activeClipId;

describe('MIDI messages', () => {
  it('parses notes, CCs, pitch bend and clock', () => {
    expect(parseMidi([0x91, 36, 100])).toEqual({ type: 'noteon', channel: 1, note: 36, velocity: 100 });
    expect(parseMidi([0x90, 36, 0])).toMatchObject({ type: 'noteoff', note: 36 });
    expect(parseMidi([0x80, 36, 64])).toMatchObject({ type: 'noteoff', note: 36 });
    expect(parseMidi([0xb2, 7, 127])).toEqual({ type: 'cc', channel: 2, cc: 7, value: 127 });
    expect(parseMidi([0xe0, 0, 64])).toEqual({ type: 'pitchbend', channel: 0, value: 8192 });
    expect(parseMidi([0xf8])).toEqual({ type: 'clock' });
    expect(parseMidi([0xf2, 4, 1])).toEqual({ type: 'songposition', sixteenths: 132 });
    expect(noteOn(9, 60, 200)).toEqual([0x99, 60, 72]);
    expect(controlChange(0, 1, 64)).toEqual([0xb0, 1, 64]);
  });

  it('decodes relative encoders', () => {
    expect(relativeSteps('relative-offset', 65)).toBe(1);
    expect(relativeSteps('relative-offset', 61)).toBe(-3);
    expect(relativeSteps('relative-twos', 1)).toBe(1);
    expect(relativeSteps('relative-twos', 127)).toBe(-1);
    expect(relativeSteps('relative-sign', 65)).toBe(-1);
  });
});

describe('targets', () => {
  it('round-trips ids and rejects nonsense', () => {
    for (const id of ['macro:2', 'master', 'opacity:0', 'slot:1:3', 'column:4', 'cue:0', 'nudge:-1', 'tempo-double', 'snap']) {
      expect(targetId(parseTarget(id)!)).toBe(id);
    }
    expect(parseTarget('slot:1')).toBeNull();
    expect(parseTarget('macro:-1')).toBeNull();
    expect(parseTarget('go:1')).toBeNull();
    expect(parseTarget('launch-missiles')).toBeNull();
  });

  it('addresses layers by row from the top', () => {
    expect(targetLabel(parseTarget('slot:0:2')!)).toBe('Clip · top / 3');
    setFader(parseTarget('opacity:1')!, 0.25);
    expect(projectStore.getState().layers.find(l => l.id === 'bottom')?.opacity).toBe(0.25);
    pressTarget(parseTarget('slot:0:2')!);
    expect(active('top')).toBe('t3');
    pressTarget(parseTarget('slot:0:1')!); // empty slot: nothing
    expect(active('top')).toBe('t3');
  });

  it('drives faders and toggles', () => {
    setFader(parseTarget('macro:3')!, 0.75);
    setFader(parseTarget('master')!, 1.5);
    setFader(parseTarget('crossfader')!, 0);
    expect(projectStore.getState().macros[3].value).toBe(0.75);
    expect(faderValue(parseTarget('master')!)).toBe(1);
    expect(liveStore.getState().crossfader).toBe(0);
    pressTarget(parseTarget('blackout')!);
    expect(liveStore.getState().blackout).toBe(true);
    pressTarget(parseTarget('snap')!);
    expect(projectStore.getState().tempo.beatSnap).toBe('beat');
  });

  it('shows clip states for LEDs', () => {
    const slot = (row: number, column: number) => buttonState(parseTarget(`slot:${row}:${column}`)!);
    expect(slot(0, 0)).toBe('available');
    expect(slot(0, 1)).toBe('off');
    pressTarget(parseTarget('column:0')!);
    expect(slot(0, 0)).toBe('playing');
    expect(slot(1, 0)).toBe('playing');
    pressTarget(parseTarget('cue:1')!);
    expect(slot(1, 1)).toBe('cued');
    expect(buttonState(parseTarget('go')!)).toBe('available');
    projectStore.getState().setTempo(t => ({ ...t, beatSnap: '4bars' }));
    pressTarget(parseTarget('go')!);
    expect(buttonState(parseTarget('go')!)).toBe('armed');
    expect(slot(1, 1)).toBe('armed');
  });
});

describe('learn mode', () => {
  it('assigns the next control to the picked target', () => {
    startLearning();
    midi([0xb0, 21, 10]); // nothing picked yet
    expect(controlStore.getState().mappings).toHaveLength(0);
    pickLearnTarget('macro:0');
    expect(midi([0x90, 40, 127])).toBe(false); // a note can't drive a fader
    expect(midi([0xb0, 21, 10])).toBe(true);
    expect(controlStore.getState().mappings).toEqual([expect.objectContaining({ target: 'macro:0', source: { kind: 'cc', device: DEV, channel: 0, cc: 21 } })]);
    expect(controlStore.getState().learned?.source).toBe(`${DEV} · CC 21 · ch 1`);
    stopLearning();
    midi([0xb0, 21, 127]);
    expect(projectStore.getState().macros[0].value).toBe(1);
  });

  it('learns keys, and Delete removes a target\'s mappings', () => {
    startLearning();
    pickLearnTarget('go');
    expect(key('KeyQ', { shiftKey: true })).toBe(true);
    expect(sourceLabel(controlStore.getState().mappings[0].source)).toBe('Key Shift+Q');
    pickLearnTarget('go');
    key('Delete');
    expect(controlStore.getState().mappings).toHaveLength(0);
  });

  it('gives a control to one target only', () => {
    assign({ kind: 'note', device: DEV, channel: 0, note: 1 }, 'go');
    assign({ kind: 'note', device: DEV, channel: 0, note: 1 }, 'tap');
    expect(controlStore.getState().mappings.map(m => m.target)).toEqual(['tap']);
  });
});

describe('mapped controls', () => {
  it('trigger clips with notes, held piano clips come back on release', () => {
    assign({ kind: 'note', device: DEV, channel: 0, note: 0 }, 'slot:1:0');
    assign({ kind: 'note', device: DEV, channel: 0, note: 1 }, 'slot:1:1');
    midi([0x90, 0, 127]);
    expect(active('bottom')).toBe('b1');
    projectStore.getState().setShow(show => ({
      ...show,
      layers: show.layers.map(l => ({ ...l, slots: l.slots.map(c => (c?.id === 'b2' ? { ...c, triggerStyle: 'piano' as const } : c)) })),
    }));
    midi([0x90, 1, 127]);
    expect(active('bottom')).toBe('b2');
    midi([0x80, 1, 0]);
    expect(active('bottom')).toBe('b1');
  });

  it('presses CC buttons on the way up only', () => {
    assign({ kind: 'cc', device: DEV, channel: 0, cc: 50 }, 'blackout');
    midi([0xb0, 50, 127]);
    midi([0xb0, 50, 127]);
    expect(liveStore.getState().blackout).toBe(true);
    midi([0xb0, 50, 0]);
    midi([0xb0, 50, 127]);
    expect(liveStore.getState().blackout).toBe(false);
  });

  it('matches the device, or any device when none is set', () => {
    assign({ kind: 'note', device: 'Other', channel: 0, note: 5 }, 'blackout');
    midi([0x90, 5, 127]);
    expect(liveStore.getState().blackout).toBe(false);
    assign({ kind: 'note', device: '', channel: 0, note: 6 }, 'blackout');
    midi([0x90, 6, 127]);
    expect(liveStore.getState().blackout).toBe(true);
  });

  it('turns relative encoders and pitch-bend faders', () => {
    assign({ kind: 'cc', device: DEV, channel: 0, cc: 1, encoding: 'relative-offset' }, 'macro:1');
    for (let i = 0; i < 4; i++) midi([0xb0, 1, 80]); // +16 each
    expect(projectStore.getState().macros[1].value).toBeCloseTo(0.5);
    midi([0xb0, 1, 0]); // -64
    expect(projectStore.getState().macros[1].value).toBe(0);
    assign({ kind: 'pitchbend', device: DEV, channel: 3 }, 'master');
    midi([0xe3, 0, 64]);
    expect(liveStore.getState().masterOpacity).toBeCloseTo(0.5, 3);
  });

  it('picks up a fader instead of jumping (pickup)', () => {
    setTakeover('pickup');
    projectStore.getState().setMacros(m => m.map((x, i) => (i === 2 ? { ...x, value: 0.6 } : x)));
    assign({ kind: 'cc', device: DEV, channel: 0, cc: 9 }, 'macro:2');
    midi([0xb0, 9, 0]);
    midi([0xb0, 9, 30]);
    expect(projectStore.getState().macros[2].value).toBe(0.6); // not caught yet
    midi([0xb0, 9, 90]); // passes 0.6
    expect(projectStore.getState().macros[2].value).toBeCloseTo(90 / 127);
    midi([0xb0, 9, 100]);
    expect(projectStore.getState().macros[2].value).toBeCloseTo(100 / 127);
  });

  it('runs mapped keys, holding nudges until the key is up', () => {
    assign({ kind: 'key', code: 'KeyJ' }, 'macro:4');
    assign({ kind: 'key', code: 'KeyK' }, 'nudge:1');
    expect(key('KeyJ')).toBe(true);
    expect(projectStore.getState().macros[4].value).toBe(1);
    expect(key('KeyJ', { shiftKey: true })).toBe(false); // Shift+J is another key
    const origin = liveStore.getState().clockOrigin;
    key('KeyK');
    expect(liveStore.getState().clockOrigin).toBeLessThan(origin);
    handleKeyUp({ code: 'KeyK' });
    expect(key('KeyA', { metaKey: true })).toBe(false);
  });
});

describe('feedback', () => {
  it('lights generic LEDs and uses template colours', () => {
    assign({ kind: 'note', device: DEV, channel: 0, note: 0 }, 'slot:0:0');
    assign({ kind: 'note', device: DEV, channel: 0, note: 1 }, 'slot:0:1');
    setTemplateMappings('tpl', [{
      source: { kind: 'note', device: DEV, channel: 0, note: 2 },
      target: 'slot:1:0',
      feedback: { states: { available: { value: 5 }, playing: { channel: 6, value: 21 } } },
    }, {
      source: { kind: 'cc', device: DEV, channel: 0, cc: 7, encoding: 'relative-offset' },
      target: 'macro:0',
      feedback: { echo: true },
    }]);
    assign({ kind: 'key', code: 'KeyZ' }, 'go');
    assign({ kind: 'note', device: '', channel: 0, note: 9 }, 'go');
    const bytes = () => Object.fromEntries(computeFeedback(controlStore.getState().mappings).map(f => [f.key, f.messages]));
    expect(bytes()).toEqual({
      [`${DEV}|note|0|0`]: [[0x90, 0, 0]], // available: off without a template
      [`${DEV}|note|0|1`]: [[0x90, 1, 0]], // empty
      [`${DEV}|note|0|2`]: [[0x90, 2, 5]],
      [`${DEV}|cc|0|7`]: [[0xb0, 7, 0]],
    });
    pressTarget(parseTarget('column:0')!);
    setFader(parseTarget('macro:0')!, 0.5);
    expect(bytes()[`${DEV}|note|0|0`]).toEqual([[0x90, 0, 127]]);
    expect(bytes()[`${DEV}|note|0|2`]).toEqual([[0x96, 2, 21]]);
    expect(bytes()[`${DEV}|cc|0|7`]).toEqual([[0xb0, 7, 64]]);
  });
});
