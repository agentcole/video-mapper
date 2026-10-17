// ---------------------------------------------------------------------------
// Tempo detection (pure). Listens to the onsets of the analysis (one value
// per hop) over the last seconds: the autocorrelation at one to four beat
// periods scores every tempo from 60 to 200 BPM, a prior around 120 BPM
// settles half/double ambiguities, and a comb over the bass onsets (the
// kick, not the hi-hats) finds where the beats fall. Like every beat
// tracker it can't know the downbeat, and ÷2 / ×2 stay the operator's call.
// ---------------------------------------------------------------------------

export const MIN_DETECT_BPM = 60;
export const MAX_DETECT_BPM = 200;
const BPM_STEP = 0.05;
const MULTIPLES = 4;
const MIN_SECONDS = 4; // listen at least this long before guessing
// Tempo prior: log-normal around 120 BPM (σ in octaves)
const PRIOR_CENTER = 120;
const PRIOR_SIGMA = 0.9;
// An estimate counts as stable when the last ones agree this closely
const STABLE_COUNT = 3;
const STABLE_BPM = 1;
// How much the full-band onsets count next to the bass for the tempo
const FLUX_WEIGHT = 0.3;

export interface TempoEstimate {
  bpm: number;
  confidence: number; // 0..1
  beatTime: number; // when a beat fell (the latest one), same time base as push()
  stable: boolean; // the last estimates agree
}

/** Linear interpolation into an array at a fractional index. */
const at = (values: Float64Array, index: number): number => {
  const i = Math.floor(index);
  const f = index - i;
  if (i < 0 || i >= values.length - 1) return i === values.length - 1 && f === 0 ? values[i] : 0;
  return values[i] * (1 - f) + values[i + 1] * f;
};

// Onsets are smoothed over a few hops: a beat rarely starts on a hop
// boundary, and without this the hop grid itself shows up as a rhythm
const SMOOTH = [1, 4, 6, 4, 1].map(w => w / 16);

/** Onsets above their local average (a moving window of ~0.2 s), smoothed, zero mean. */
const peaks = (onsets: ArrayLike<number>, rate: number): Float64Array => {
  const n = onsets.length;
  const half = Math.max(1, Math.round(0.1 * rate));
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let local = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      local += onsets[j];
      count++;
    }
    raw[i] = Math.max(0, onsets[i] - local / count);
  }
  const o = new Float64Array(n);
  const reach = (SMOOTH.length - 1) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = -reach; k <= reach; k++) v += SMOOTH[k + reach] * (raw[Math.min(n - 1, Math.max(0, i + k))]);
    o[i] = v;
    sum += v;
  }
  const mean = sum / n;
  for (let i = 0; i < n; i++) o[i] -= mean;
  return o;
};

/**
 * Estimate the tempo of an onset series (`rate` values per second, oldest
 * first); the beat phase comes from `phaseOnsets` (the bass) when given.
 * `beatOffset` is where the last beat falls, in samples before the end.
 * Returns null when there's nothing periodic.
 */
export const estimateTempo = (
  onsets: ArrayLike<number>, rate: number, phaseOnsets?: ArrayLike<number>,
): { bpm: number; confidence: number; beatOffset: number } | null => {
  const n = onsets.length;
  if (n < MIN_SECONDS * rate) return null;
  const o = peaks(onsets, rate);

  // Normalised autocorrelation up to four beats at the slowest tempo
  const maxLag = Math.min(n - 1, Math.ceil((MULTIPLES * 60 * rate) / MIN_DETECT_BPM) + 1);
  const r = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = lag; i < n; i++) acc += o[i] * o[i - lag];
    r[lag] = acc / (n - lag);
  }
  if (!(r[0] > 1e-12)) return null;
  for (let lag = maxLag; lag >= 0; lag--) r[lag] /= r[0];

  let best = { bpm: 0, score: -Infinity, raw: 0 };
  let rawSum = 0;
  let candidates = 0;
  for (let bpm = MIN_DETECT_BPM; bpm <= MAX_DETECT_BPM + 1e-9; bpm += BPM_STEP) {
    const period = (60 * rate) / bpm;
    let raw = 0;
    for (let m = 1; m <= MULTIPLES; m++) raw += m * period <= maxLag ? at(r, m * period) : 0;
    raw /= MULTIPLES;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / PRIOR_CENTER) / PRIOR_SIGMA) ** 2);
    const score = raw * prior;
    rawSum += raw;
    candidates++;
    if (score > best.score) best = { bpm, score, raw };
  }
  // Periodic onsets stand out from the average tempo's score
  const confidence = Math.min(1, Math.max(0, (best.raw - rawSum / candidates) / 0.35));
  if (best.raw <= 0) return null;

  // Phase: the offset whose comb of beats collects the most onset strength
  let p = o;
  if (phaseOnsets && phaseOnsets.length === n) {
    let energy = 0;
    for (let i = 0; i < n; i++) energy += phaseOnsets[i];
    if (energy > 1e-6) p = peaks(phaseOnsets, rate);
  }
  const period = (60 * rate) / best.bpm;
  let bestOffset = 0;
  let bestComb = -Infinity;
  for (let offset = 0; offset < period; offset += 0.25) {
    let comb = 0;
    for (let index = n - 1 - offset; index >= 0; index -= period) comb += at(p, index);
    if (comb > bestComb) {
      bestComb = comb;
      bestOffset = offset;
    }
  }
  const refined = refine(p, period, n - 1 - bestOffset);
  if (refined && Math.abs(refined.period - period) < period * 0.02) {
    return { bpm: Math.round(((60 * rate) / refined.period) * 10) / 10, confidence, beatOffset: n - 1 - refined.last };
  }
  return { bpm: Math.round(best.bpm * 10) / 10, confidence, beatOffset: bestOffset };
};

/**
 * Sharpen the tempo like tap tempo does: find the onset peak near each
 * expected beat and fit a line through them (least squares).
 */
const refine = (p: Float64Array, period: number, last: number): { period: number; last: number } | null => {
  let max = 0;
  for (const v of p) max = Math.max(max, v);
  if (!(max > 0)) return null;
  const points: { k: number; position: number }[] = [];
  const reach = Math.max(1, Math.floor(period / 4));
  for (let k = 0; last - k * period >= 1; k++) {
    const expected = Math.round(last - k * period);
    let peak = -1;
    for (let i = Math.max(1, expected - reach); i <= Math.min(p.length - 2, expected + reach); i++) {
      if (peak < 0 || p[i] > p[peak]) peak = i;
    }
    if (peak < 0 || p[peak] < 0.3 * max) continue;
    // Parabola through the peak and its neighbours: where between samples it is
    const [a, b, c] = [p[peak - 1], p[peak], p[peak + 1]];
    const denominator = a - 2 * b + c;
    const shift = denominator !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denominator)) : 0;
    points.push({ k, position: peak + shift });
  }
  if (points.length < 4) return null;
  const meanK = points.reduce((sum, q) => sum + q.k, 0) / points.length;
  const meanPos = points.reduce((sum, q) => sum + q.position, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const q of points) {
    covariance += (q.k - meanK) * (q.position - meanPos);
    variance += (q.k - meanK) ** 2;
  }
  if (variance === 0) return null;
  const slope = covariance / variance; // -period
  return { period: -slope, last: meanPos - slope * meanK };
};

/** Collects onset strength as it arrives and estimates the tempo now and then. */
export class TempoTracker {
  private readonly rate: number;
  private readonly onsets: Float64Array; // bass + full band, for the tempo
  private readonly bass: Float64Array; // bass, for the phase
  private filled = 0;
  private write = 0;
  private latestTime = 0;
  private recent: number[] = [];
  // Onsets arrive a little after the beat (analysis window); this much earlier is the beat
  private readonly latencyMs: number;

  constructor(rate: number, { seconds = 10, latencyMs = 0 } = {}) {
    this.rate = rate;
    this.onsets = new Float64Array(Math.round(seconds * rate));
    this.bass = new Float64Array(this.onsets.length);
    this.latencyMs = latencyMs;
  }

  /** One hop of the analysis (its flux and bass flux); `time` is when it was measured (ms). */
  push(flux: number, bassFlux: number, time: number): void {
    const f = Number.isFinite(flux) ? flux : 0;
    const b = Number.isFinite(bassFlux) ? bassFlux : 0;
    this.onsets[this.write] = b + FLUX_WEIGHT * f;
    this.bass[this.write] = b;
    this.write = (this.write + 1) % this.onsets.length;
    this.filled = Math.min(this.onsets.length, this.filled + 1);
    this.latestTime = time;
  }

  reset(): void {
    this.filled = 0;
    this.write = 0;
    this.recent = [];
  }

  estimate(): TempoEstimate | null {
    const n = this.filled;
    const series = new Float64Array(n);
    const bass = new Float64Array(n);
    const start = (this.write - n + this.onsets.length) % this.onsets.length;
    for (let i = 0; i < n; i++) {
      series[i] = this.onsets[(start + i) % this.onsets.length];
      bass[i] = this.bass[(start + i) % this.onsets.length];
    }
    const result = estimateTempo(series, this.rate, bass);
    if (!result) {
      this.recent = [];
      return null;
    }
    this.recent = [...this.recent, result.bpm].slice(-STABLE_COUNT);
    const stable = this.recent.length === STABLE_COUNT &&
      Math.max(...this.recent) - Math.min(...this.recent) <= STABLE_BPM;
    return {
      bpm: result.bpm,
      confidence: result.confidence,
      beatTime: this.latestTime - (result.beatOffset / this.rate) * 1000 - this.latencyMs,
      stable,
    };
  }
}
