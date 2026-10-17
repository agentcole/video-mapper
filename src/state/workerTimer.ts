// ---------------------------------------------------------------------------
// A timeout that keeps time while the window is hidden. Browsers throttle
// the timers of hidden pages (to once a second, later once a minute), not
// those of a worker — so beat-snapped triggers fired from a MIDI controller
// still land on the beat when the editor is behind the output window.
// Falls back to setTimeout where there are no workers (tests).
// ---------------------------------------------------------------------------

const SOURCE = `const timers = new Map();
onmessage = (e) => {
  const { id, delay, cancel } = e.data;
  if (cancel) { clearTimeout(timers.get(id)); timers.delete(id); return; }
  timers.set(id, setTimeout(() => { timers.delete(id); postMessage(id); }, delay));
};`;

let worker: Worker | null | undefined;
const callbacks = new Map<number, () => void>();
let nextId = 1;

const getWorker = (): Worker | null => {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([SOURCE], { type: 'text/javascript' })));
    worker.onmessage = (event: MessageEvent<number>) => {
      const callback = callbacks.get(event.data);
      callbacks.delete(event.data);
      callback?.();
    };
  } catch {
    worker = null;
  }
  return worker;
};

/** Run `callback` after `delay` ms; returns a cancel function. */
export const setWorkerTimeout = (callback: () => void, delay: number): (() => void) => {
  const w = typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? getWorker()
    : null;
  if (!w) {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  }
  const id = nextId++;
  callbacks.set(id, callback);
  w.postMessage({ id, delay: Math.max(0, delay) });
  return () => {
    if (callbacks.delete(id)) w.postMessage({ id, cancel: true });
  };
};
