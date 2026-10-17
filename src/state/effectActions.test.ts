import { beforeEach, describe, expect, it } from 'vitest';
import { projectStore } from './projectStore';
import { createClip, createColumns, type IdFactory } from './showModel';
import {
  addEffect, assignGenerator, moveEffect, removeEffect, resetEffect, resetGenerator, setEffectMod, setEffectParam,
  setGeneratorMod, setGeneratorParam, stackOf, toggleEffect, type EffectTarget,
} from './effectActions';
import { renameMacro, setLayerMod, setMacroValue } from './modActions';
import type { Modulation } from '../types';

const counterIds = (): IdFactory => {
  let n = 0;
  return kind => `${kind}-${++n}`;
};

describe('effect stacks', () => {
  beforeEach(() => {
    const clip = createClip('c1', { type: 'video', url: 'blob:c1' });
    projectStore.getState().replaceDocument({
      columns: createColumns(),
      layers: [{ id: 'L', name: 'L', opacity: 1, blendMode: 'normal', slots: [clip, ...Array(7).fill(null)], activeClipId: 'c1' }],
      surfaces: [],
      effects: [],
    });
  });

  const targets: EffectTarget[] = [{ kind: 'clip', clipId: 'c1' }, { kind: 'layer', layerId: 'L' }, { kind: 'composition' }];

  it.each(targets)('adds, orders, edits and removes effects on a $kind', (target) => {
    const ids = counterIds();
    const a = addEffect(target, 'builtin:invert', ids);
    const b = addEffect(target, 'builtin:blur', ids);
    expect(stackOf(target).map(e => e.effectId)).toEqual(['builtin:invert', 'builtin:blur']);
    moveEffect(target, b, -1);
    expect(stackOf(target).map(e => e.id)).toEqual([b, a]);
    moveEffect(target, b, -1); // already on top
    expect(stackOf(target).map(e => e.id)).toEqual([b, a]);
    setEffectParam(target, b, 'radius', 20);
    toggleEffect(target, a);
    expect(stackOf(target)).toMatchObject([{ id: b, params: { radius: 20 } }, { id: a, enabled: false }]);
    resetEffect(target, b);
    expect(stackOf(target)[0].params).toEqual({});
    removeEffect(target, a);
    removeEffect(target, b);
    expect(stackOf(target)).toEqual([]);
  });

  it('derives clip and layer stacks into frames', () => {
    projectStore.getState().setShow(show => ({
      ...show,
      surfaces: [{
        id: 's', layerId: 'L', visible: true, testPattern: false, zIndex: 0, x: 0, y: 0, width: 10, height: 10, rotation: 0,
        shape: 'rectangle', lockAspectRatio: true, perspectiveMode: false,
        perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
        softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
      }],
    }));
    addEffect({ kind: 'clip', clipId: 'c1' }, 'builtin:invert');
    addEffect({ kind: 'layer', layerId: 'L' }, 'builtin:blur');
    const [frame] = projectStore.getState().frames;
    expect(frame.clipEffects?.map(e => e.effectId)).toEqual(['builtin:invert']);
    expect(frame.layerEffects?.map(e => e.effectId)).toEqual(['builtin:blur']);
  });

  it('puts generators into slots and edits their parameters', () => {
    const clipId = assignGenerator({ layerId: 'L', column: 1 }, 'builtin:plasma', counterIds());
    setGeneratorParam(clipId, 'speed', 2);
    const clip = projectStore.getState().layers[0].slots[1]!;
    expect(clip).toMatchObject({ id: clipId, name: 'Plasma', generator: { effectId: 'builtin:plasma', params: { speed: 2 } } });
    expect(clip.source).toEqual({ type: 'image', url: '' });
  });
});

describe('modulation', () => {
  const lfo: Modulation = { source: { kind: 'lfo', shape: 'sine', period: 4, beats: true }, amount: 0.5 };
  const kick: Modulation = { source: { kind: 'audio', band: 'kick' }, amount: 1 };

  beforeEach(() => {
    const clip = createClip('c1', { type: 'video', url: 'blob:c1' });
    projectStore.getState().replaceDocument({
      columns: createColumns(),
      layers: [{ id: 'L', name: 'L', opacity: 1, blendMode: 'normal', slots: [clip, ...Array(7).fill(null)], activeClipId: 'c1' }],
      surfaces: [],
      effects: [],
    });
  });

  it.each([{ kind: 'clip', clipId: 'c1' }, { kind: 'layer', layerId: 'L' }, { kind: 'composition' }] as EffectTarget[])(
    'sets and removes effect parameter modulations on a $kind', (target) => {
      const id = addEffect(target, 'builtin:invert');
      setEffectMod(target, id, 'amount', lfo);
      setEffectMod(target, id, 'center.1', kick);
      expect(stackOf(target)[0].mods).toEqual({ amount: lfo, 'center.1': kick });
      setEffectMod(target, id, 'amount', null);
      expect(stackOf(target)[0].mods).toEqual({ 'center.1': kick });
      setEffectMod(target, id, 'center.1', null);
      expect(stackOf(target)[0].mods).toBeUndefined();
      setEffectMod(target, id, 'amount', lfo);
      resetEffect(target, id);
      expect(stackOf(target)[0].mods).toBeUndefined();
    },
  );

  it('modulates generator parameters and layer properties', () => {
    const clipId = assignGenerator({ layerId: 'L', column: 1 }, 'builtin:plasma');
    setGeneratorMod(clipId, 'speed', kick);
    expect(projectStore.getState().layers[0].slots[1]?.generator?.mods).toEqual({ speed: kick });
    resetGenerator(clipId);
    expect(projectStore.getState().layers[0].slots[1]?.generator?.mods).toBeUndefined();

    setLayerMod('L', 'opacity', lfo);
    expect(projectStore.getState().layers[0].mods).toEqual({ opacity: lfo });
    setLayerMod('L', 'opacity', null);
    expect(projectStore.getState().layers[0].mods).toBeUndefined();
  });

  it('moves and names macro faders', () => {
    setMacroValue(2, 0.75);
    setMacroValue(3, 4);
    renameMacro(2, '  Strobe  ');
    const macros = projectStore.getState().macros;
    expect(macros[2]).toEqual({ name: 'Strobe', value: 0.75 });
    expect(macros[3].value).toBe(1);
    renameMacro(2, '');
    expect(projectStore.getState().macros[2].name).toBe('Macro 3');
    const before = projectStore.getState().macros;
    setMacroValue(2, 0.75); // no change, no update
    expect(projectStore.getState().macros).toBe(before);
  });
});
