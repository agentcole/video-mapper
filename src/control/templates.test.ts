import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATES, templatesFor } from './templates';
import { clearMappings, controlStore, setTemplateMappings, sourceKey } from './mappings';
import { parseTarget } from './targets';
import { computeFeedback } from './feedback';
import { portKey } from './midi';
import { projectStore } from '../state/projectStore';
import { liveStore } from '../state/liveStore';
import { createClip, createColumns, type Layer } from '../state/showModel';

const D = 'Controller';
const byId = (id: string) => TEMPLATES.find(t => t.id === id)!;
const targetOf = (id: string, kind: 'note' | 'cc', channel: number, n: number) =>
  byId(id).mappings(D).find(m => m.source.kind === kind && m.source.channel === channel &&
    (m.source.kind === 'note' ? m.source.note : m.source.kind === 'cc' ? m.source.cc : -1) === n)?.target;

describe('controller templates', () => {
  it.each(TEMPLATES.map(t => [t.id, t] as const))('%s maps each control once, to real targets', (_, template) => {
    const mappings = template.mappings(D);
    expect(new Set(mappings.map(m => sourceKey(m.source))).size).toBe(mappings.length);
    for (const m of mappings) expect(parseTarget(m.target), m.target).not.toBeNull();
  });

  it('puts layer 1 / column 1 top left on every grid', () => {
    expect(targetOf('apc-mini-mk2', 'note', 0, 56)).toBe('slot:0:0');
    expect(targetOf('apc-mini-mk2', 'note', 0, 7)).toBe('slot:7:7');
    expect(targetOf('launchpad-mini-mk3', 'note', 0, 81)).toBe('slot:0:0');
    expect(targetOf('launchpad-mini-mk3', 'note', 0, 18)).toBe('slot:7:7');
    expect(targetOf('launchpad-x', 'cc', 0, 89)).toBe('clear:0');
    expect(targetOf('launchpad-x', 'cc', 0, 91)).toBe('column:0');
    expect(targetOf('apc40-mk2', 'note', 0, 32)).toBe('slot:0:0');
    expect(targetOf('apc40-mk2', 'note', 0, 7)).toBe('slot:4:7');
    expect(targetOf('apc40-mk2', 'note', 3, 52)).toBe('column:3');
    expect(targetOf('apc40-mk2', 'cc', 5, 7)).toBe('opacity:5');
    expect(targetOf('nanokontrol2', 'cc', 0, 41)).toBe('go');
    expect(targetOf('midi-fighter-twister', 'cc', 1, 15)).toBe('blackout');
  });

  it('recognises controllers by their port names', () => {
    const ids = (name: string) => templatesFor(name).map(t => t.id);
    expect(ids('APC mini mk2 Control')).toEqual(['apc-mini-mk2']);
    expect(ids('APC40 mkII')).toEqual(['apc40-mk2']);
    expect(ids('Launchpad Mini MK3 LPMiniMK3 MIDI Out')).toEqual(['launchpad-mini-mk3']);
    expect(ids('MIDIIN2 (LPMiniMK3 MIDI)')).toEqual(['launchpad-mini-mk3']);
    expect(ids('Launchpad Mini MK3 LPMiniMK3 DAW Out')).toEqual([]);
    expect(ids('Launchpad X LPX MIDI Out')).toEqual(['launchpad-x']);
    expect(ids('nanoKONTROL2 SLIDER/KNOB')).toEqual(['nanokontrol2']);
    expect(ids('Midi Fighter Twister')).toEqual(['midi-fighter-twister']);
    expect(ids('IAC Driver Bus 1')).toEqual([]);
  });

  it('pairs inputs with their outputs', () => {
    expect(portKey('Launchpad Mini MK3 LPMiniMK3 MIDI Out')).toBe(portKey('Launchpad Mini MK3 LPMiniMK3 MIDI In'));
    expect(portKey('MIDIIN2 (LPMiniMK3 MIDI)')).toBe(portKey('MIDIOUT2 (LPMiniMK3 MIDI)'));
    expect(portKey('nanoKONTROL2 SLIDER/KNOB')).toBe(portKey('nanoKONTROL2 CTRL'));
    expect(portKey('Launchpad Mini MK3 LPMiniMK3 DAW Out')).not.toBe(portKey('Launchpad Mini MK3 LPMiniMK3 MIDI In'));
  });
});

describe('template LEDs', () => {
  const layer = (id: string, clips: string[]): Layer => ({
    id, name: id, opacity: 1, blendMode: 'normal', activeClipId: null,
    slots: [...clips.map(c => createClip(c, { type: 'video', url: `blob:${c}` })), ...Array(8 - clips.length).fill(null)],
  });

  beforeEach(() => {
    projectStore.getState().replaceDocument({ columns: createColumns(), layers: [layer('only', ['a'])], surfaces: [], effects: [] });
    projectStore.getState().setTempo(t => ({ ...t, beatSnap: 'off' }));
    liveStore.setState({ scheduled: [], cuedColumn: null });
    clearMappings();
  });

  const leds = () => Object.fromEntries(computeFeedback(controlStore.getState().mappings).map(f => [f.key, f.messages]));

  it('colours APC mini mk2 pads by state, blinking while armed', () => {
    setTemplateMappings('apc-mini-mk2', byId('apc-mini-mk2').mappings(D));
    expect(leds()[`${D}|note|0|56`]).toEqual([[0x96, 56, 1]]); // a clip: dim
    expect(leds()[`${D}|note|0|57`]).toEqual([[0x90, 57, 0]]); // empty: off
    liveStore.setState({ cuedColumn: 0, scheduled: [{ kind: 'go', at: Date.now() + 1000, beats: 4 }] });
    expect(leds()[`${D}|note|0|56`]).toEqual([[0x9e, 56, 9]]); // amber blink
    expect(leds()[`${D}|note|0|100`]).toEqual([[0x90, 100, 2]]); // column button blinks
  });

  it('flashes Launchpad pads with two messages', () => {
    setTemplateMappings('launchpad-x', byId('launchpad-x').mappings(D));
    liveStore.setState({ cuedColumn: 0, scheduled: [{ kind: 'go', at: Date.now() + 1000, beats: 4 }] });
    expect(leds()[`${D}|note|0|81`]).toEqual([[0x90, 81, 0], [0x91, 81, 9]]);
  });
});
