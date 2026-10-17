import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { effectLibrary, effectsOfKind, getEffectDef, hashSource, importIsf, loadUserEffects } from './library';
import { buildFragmentShader } from './isf';

describe('effect library', () => {
  const defs = Object.values(effectLibrary.getState().defs);

  it('bundles readable ISF effects and generators', () => {
    const broken = defs.filter(d => d.error).map(d => `${d.id}: ${d.error}`);
    expect(broken).toEqual([]);
    expect(effectsOfKind(effectLibrary.getState().defs, 'effect').length).toBeGreaterThanOrEqual(25);
    expect(effectsOfKind(effectLibrary.getState().defs, 'generator').length).toBeGreaterThanOrEqual(10);
    // Every bundled shader translates (GLSL compile is checked in the browser, ?isf-check)
    for (const def of defs) expect(() => buildFragmentShader(def.shader!)).not.toThrow();
  });

  it('names bundled shaders by their label', () => {
    expect(getEffectDef('builtin:rgb-split')?.name).toBe('RGB Split');
    expect(getEffectDef('builtin:feedback')?.shader?.passes[0]).toMatchObject({ target: 'trails', persistent: true });
  });

  it('imports user shaders once per content and keeps them in IndexedDB', async () => {
    const source = '/*{ "CATEGORIES": ["Mine"], "INPUTS": [ { "NAME": "inputImage", "TYPE": "image" } ] }*/\nvoid main() { gl_FragColor = IMG_THIS_PIXEL(inputImage); }';
    const def = await importIsf('my_effect.fs', source);
    expect(def).toMatchObject({ id: `user:${hashSource(source)}`, name: 'My Effect', kind: 'effect', builtin: false });
    expect((await importIsf('again.fs', source)).id).toBe(def.id);
    effectLibrary.setState(s => {
      const next = { ...s.defs };
      delete next[def.id];
      return { defs: next };
    });
    await loadUserEffects(true);
    expect(getEffectDef(def.id)?.categories).toEqual(['Mine']);
  });

  it('reports files that are not ISF instead of storing them', async () => {
    const def = await importIsf('broken.fs', 'void main() {}');
    expect(def.error).toMatch(/No ISF header/);
    expect(getEffectDef(def.id)).toBeUndefined();
  });
});
