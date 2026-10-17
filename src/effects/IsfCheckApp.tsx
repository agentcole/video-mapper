import React, { useEffect, useState } from 'react';
import { effectKey, effectLibrary, loadUserEffects } from './library';
import { EffectRunner } from '../render/webgl/EffectRunner';

// ---------------------------------------------------------------------------
// ?isf-check — compiles and runs every shader of the effect library in this
// browser's WebGL2 and lists the results (for shader authors).
// ---------------------------------------------------------------------------

interface Result {
  id: string;
  name: string;
  kind: string;
  error: string | null;
  ms: number;
}

export const IsfCheckApp: React.FC = () => {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    void (async () => {
      await loadUserEffects();
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) {
        setResults([]);
        return;
      }
      const runner = new EffectRunner(gl);
      const input = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, input);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 64, 36, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      runner.beginFrame({ time: 1, delta: 1 / 60, frame: 1, bpm: 120, beat: 2 });
      const list: Result[] = [];
      for (const def of Object.values(effectLibrary.getState().defs)) {
        const started = performance.now();
        let error = def.error ?? null;
        if (def.shader) {
          const effect = { instance: { id: 'check', enabled: true, params: {} }, shader: def.shader, key: effectKey(def) };
          error = runner.check(effect);
          if (!error) {
            runner.run(def.id, def.kind === 'generator' ? null : { texture: input, width: 64, height: 36, yUp: false }, [effect], { width: 64, height: 36 });
            const glError = gl.getError();
            if (glError !== gl.NO_ERROR) error = `WebGL error ${glError}`;
          }
        }
        list.push({ id: def.id, name: def.name, kind: def.kind ?? '?', error, ms: performance.now() - started });
      }
      runner.dispose();
      setResults(list.sort((a, b) => Number(!!b.error) - Number(!!a.error) || a.name.localeCompare(b.name)));
    })();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 text-xs">
      <h1 className="text-sm font-bold mb-3">ISF shader check</h1>
      {!results ? <p>Compiling…</p> : results.length === 0 ? <p>WebGL2 isn't available.</p> : (
        <>
          <p className="mb-3 text-gray-400" id="isf-summary">
            {results.filter(r => !r.error).length} of {results.length} shaders compile and run.
          </p>
          <table className="w-full max-w-4xl">
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="border-t border-white/10 align-top">
                  <td className={`py-1 pr-3 ${r.error ? 'text-red-300' : 'text-emerald-300'}`}>{r.error ? '✗' : '✓'}</td>
                  <td className="py-1 pr-3">{r.name}</td>
                  <td className="py-1 pr-3 text-gray-400">{r.kind}</td>
                  <td className="py-1 pr-3 text-gray-500">{r.id}</td>
                  <td className="py-1 whitespace-pre-wrap text-red-300">{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};
