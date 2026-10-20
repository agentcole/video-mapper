// Synthetic audio for the analysis and tempo tests

export const SAMPLE_RATE = 48000;

/** Deterministic noise (-1..1). */
export const noise = (seed = 1) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
};

export const sine = (frequency: number, seconds: number, amplitude = 1, rate = SAMPLE_RATE): Float32Array => {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / rate);
  return out;
};

/**
 * A four-to-the-floor loop: kicks (a falling 50 Hz sine) on every beat,
 * hi-hats (noise bursts) on the off-beats, a little noise underneath.
 * Returns the samples and the kick times (s).
 */
export const kickLoop = (
  bpm: number, seconds: number, { offset = 0.1, hats = true, rate = SAMPLE_RATE } = {},
): { samples: Float32Array; kicks: number[] } => {
  const out = new Float32Array(Math.round(seconds * rate));
  const rnd = noise(7);
  for (let i = 0; i < out.length; i++) out[i] = 0.01 * rnd();
  const beat = 60 / bpm;
  const kicks: number[] = [];
  for (let t = offset; t < seconds; t += beat) {
    kicks.push(t);
    const start = Math.round(t * rate);
    let phase = 0;
    for (let i = 0; i < 0.25 * rate && start + i < out.length; i++) {
      const env = Math.exp(-i / (0.07 * rate));
      phase += (2 * Math.PI * (50 + 100 * Math.exp(-i / (0.01 * rate)))) / rate;
      out[start + i] += 0.8 * env * Math.sin(phase);
    }
    if (hats) {
      const hat = Math.round((t + beat / 2) * rate);
      for (let i = 0; i < 0.03 * rate && hat + i < out.length; i++) {
        out[hat + i] += 0.2 * Math.exp(-i / (0.008 * rate)) * rnd();
      }
    }
  }
  return { samples: out, kicks };
};
