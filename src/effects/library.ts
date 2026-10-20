import { createStore, useStore } from 'zustand';
import { IsfError, parseIsf, type IsfKind, type IsfShader } from './isf';
import { openDatabase, promisify, transactionDone } from '../lib/idb';

// ---------------------------------------------------------------------------
// The effect library: ISF shaders bundled with the app (src/effects/isf, MIT)
// plus ones the user imports (kept in IndexedDB, shared by every window of
// this browser). Projects refer to shaders by id: `builtin:<file>` or
// `user:<content hash>`, so importing the same file twice gives one entry.
// ---------------------------------------------------------------------------

export interface EffectDef {
  id: string;
  name: string;
  builtin: boolean;
  source: string;
  shader: IsfShader | null;
  error?: string; // the file couldn't be read as ISF
  kind: IsfKind | null;
  categories: string[];
}

const humanize = (stem: string) =>
  stem.replace(/\.(fs|frag|isf|glsl|txt)$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

export const defineEffect = (id: string, fileName: string, source: string, builtin: boolean): EffectDef => {
  try {
    const shader = parseIsf(source);
    return {
      id, name: shader.label ?? humanize(fileName), builtin, source, shader,
      kind: shader.kind, categories: shader.categories.length > 0 ? shader.categories : ['Other'],
    };
  } catch (error) {
    return {
      id, name: humanize(fileName), builtin, source, shader: null, kind: null, categories: ['Other'],
      error: error instanceof IsfError ? error.message : String(error),
    };
  }
};

const BUNDLED = import.meta.glob('./isf/*.fs', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const bundledDefs = (): Record<string, EffectDef> => {
  const defs: Record<string, EffectDef> = {};
  for (const [path, source] of Object.entries(BUNDLED)) {
    const stem = path.split('/').pop()!.replace(/\.fs$/, '');
    const def = defineEffect(`builtin:${stem}`, stem, source, true);
    defs[def.id] = def;
  }
  return defs;
};

interface LibraryState {
  defs: Record<string, EffectDef>;
  userLoaded: boolean;
  // GLSL compile errors reported by a renderer, by effect id
  compileErrors: Record<string, string>;
}

export const effectLibrary = createStore<LibraryState>()(() => ({
  defs: bundledDefs(), userLoaded: false, compileErrors: {},
}));

export const reportCompileError = (effectId: string, message: string): void =>
  effectLibrary.setState(s => (s.compileErrors[effectId] === message
    ? s
    : { compileErrors: { ...s.compileErrors, [effectId]: message } }));

export function useEffectLibrary<T>(selector: (state: LibraryState) => T): T {
  return useStore(effectLibrary, selector);
}

export const getEffectDef = (id: string): EffectDef | undefined => effectLibrary.getState().defs[id];

/** A def's version key for compiled programs: id + content hash. */
export const effectKey = (def: EffectDef): string => `${def.id}#${hashSource(def.source)}`;

// Projects may name shaders this window hasn't loaded yet (imported in
// another window) — look again, but not on every frame
let lastReload = 0;
export const requestUnknownEffect = (): void => {
  if (Date.now() - lastReload < 5000) return;
  lastReload = Date.now();
  void loadUserEffects(true);
};

/** Every shader of a kind, sorted by category then name. */
export const effectsOfKind = (defs: Record<string, EffectDef>, kind: IsfKind): EffectDef[] =>
  Object.values(defs)
    .filter(d => d.kind === kind)
    .sort((a, b) => a.categories[0].localeCompare(b.categories[0]) || a.name.localeCompare(b.name));

// ---- User shaders (IndexedDB) -------------------------------------------------------

const DB_NAME = 'video-mapper-effects';
const STORE = 'shaders';

interface StoredShader {
  id: string;
  name: string; // file name
  source: string;
  addedAt: number;
}

const openDb = () => openDatabase(DB_NAME, 1, db => {
  if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
});

/** FNV-1a: a short, stable id for a shader's text. */
export const hashSource = (source: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

const addDefs = (defs: EffectDef[]) =>
  effectLibrary.setState(s => ({ defs: { ...s.defs, ...Object.fromEntries(defs.map(d => [d.id, d])) } }));

let loading: Promise<void> | null = null;

/** Load the user's shaders (once; again with `force`, e.g. when a project names one we don't know). */
export const loadUserEffects = (force = false): Promise<void> => {
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, 'readonly');
      const stored = await promisify(tx.objectStore(STORE).getAll() as IDBRequest<StoredShader[]>);
      db.close();
      addDefs(stored.map(s => defineEffect(s.id, s.name, s.source, false)));
    } catch (error) {
      console.warn('Could not load imported effects:', error);
    } finally {
      effectLibrary.setState({ userLoaded: true });
    }
  })();
  return loading;
};

/** Add an ISF file to the library; returns its definition (with an error if it isn't ISF). */
export const importIsf = async (name: string, source: string): Promise<EffectDef> => {
  const def = defineEffect(`user:${hashSource(source)}`, name, source, false);
  if (def.error) return def;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ id: def.id, name, source, addedAt: Date.now() } satisfies StoredShader);
  await transactionDone(tx);
  db.close();
  addDefs([def]);
  return def;
};

export const removeUserEffect = async (id: string): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await transactionDone(tx);
  db.close();
  effectLibrary.setState(s => {
    const defs = { ...s.defs };
    delete defs[id];
    return { defs };
  });
};
