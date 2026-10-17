import type { AudioLevels } from '../state/modulation';

// ---------------------------------------------------------------------------
// Audio analysis (pure, runs in the AudioWorklet and in tests). Every hop of
// 512 samples it measures the overall level and three bands (IIR filters,
// so a kick shows within ~10 ms), detects kicks, and takes a 1024-point FFT
// for the spectrum and the onset strength the tempo detection listens to.
//
// Levels are mapped from dB to 0..1: with a manual gain, or with auto gain
// that follows each band's recent peak — then every band reaches 1 on its
// own loudest moments, whatever the room level.
// ---------------------------------------------------------------------------

export const FFT_SIZE = 1024;
export const HOP_SIZE = 512;
export const SPECTRUM_SIZE = FFT_SIZE / 2; // bins, 0 Hz … Nyquist
export const WAVEFORM_SIZE = 512;

export interface AnalysisSettings {
  gain: number; // dB added before mapping (manual gain)
  autoGain: boolean;
  smoothing: number; // 0..1: how slowly levels fall (attack is instant)
}

export const DEFAULT_ANALYSIS: AnalysisSettings = { gain: 0, autoGain: true, smoothing: 0.3 };

export interface AnalysisFrame {
  frame: number; // sample index (since the analysis started) at the end of this hop
  levels: AudioLevels;
  flux: number; // onset strength (spectral flux), for the tempo detection
  bassFlux: number; // rise of the bass level (0..1) — the kick, where the beat usually is
  spectrum: Uint8Array; // SPECTRUM_SIZE bins, 0..255
  waveform: Uint8Array; // WAVEFORM_SIZE samples, 128 = silence
}

// Levels: dB below the top that still count (manual: below 0 dBFS, auto: below the peak)
const MANUAL_RANGE_DB = 36;
const AUTO_RANGE_DB = 24;
const SPECTRUM_RANGE_DB = 60;
// Auto gain: peaks fall this fast, and quieter than this is silence
const PEAK_FALL_DB_PER_S = 2;
const NOISE_FLOOR_DB = -66;
// Kick: the bass rises this much within two hops, near its recent peak
const KICK_RISE_DB = 6;
const KICK_NEAR_PEAK_DB = 18;
const KICK_MIN_INTERVAL_S = 0.1;

// ---- FFT ------------------------------------------------------------------------------

/** In-place radix-2 complex FFT of a fixed size. */
export class Fft {
  readonly size: number;
  private cos: Float64Array;
  private sin: Float64Array;
  private reverse: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.size = size;
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
    this.reverse = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reverse[i] = r;
    }
  }

  transform(re: Float64Array, im: Float64Array): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      const j = this.reverse[i];
      if (j > i) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const c = this.cos[k * step];
          const s = this.sin[k * step];
          const a = start + k;
          const b = a + half;
          const tr = re[b] * c - im[b] * s;
          const ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}

// ---- Biquad filters (RBJ cookbook) -----------------------------------------------------------

class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;

  constructor(type: 'lowpass' | 'highpass', frequency: number, sampleRate: number, q = Math.SQRT1_2) {
    const w = (2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    const a0 = 1 + alpha;
    const [b0, b1, b2] = type === 'lowpass'
      ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
      : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ---- Analyzer -----------------------------------------------------------------------------------

const BANDS = ['level', 'bass', 'mid', 'high'] as const;
type Band = (typeof BANDS)[number];

const toDb = (rms: number) => 20 * Math.log10(rms * Math.SQRT2 + 1e-12); // a full-scale sine is 0 dB
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class AudioAnalyzer {
  private settings: AnalysisSettings;
  private readonly sampleRate: number;
  private readonly hopSeconds: number;
  private fft = new Fft(FFT_SIZE);
  private window = new Float64Array(FFT_SIZE);
  private ring = new Float32Array(FFT_SIZE); // the last FFT_SIZE samples
  private ringPos = 0;
  private hopFill = 0;
  private samples = 0;
  private re = new Float64Array(FFT_SIZE);
  private im = new Float64Array(FFT_SIZE);
  private logMag = new Float64Array(SPECTRUM_SIZE);
  private spectrumSmooth = new Float64Array(SPECTRUM_SIZE);
  // Band filters: bass < 150 Hz, mid 150 Hz – 2.5 kHz, high > 2.5 kHz
  private bassLp: Biquad;
  private midHp: Biquad;
  private midLp: Biquad;
  private highHp: Biquad;
  private sumSquares: Record<Band, number> = { level: 0, bass: 0, mid: 0, high: 0 };
  private peakDb: Record<Band, number> = { level: NOISE_FLOOR_DB, bass: NOISE_FLOOR_DB, mid: NOISE_FLOOR_DB, high: NOISE_FLOOR_DB };
  private smoothed: AudioLevels = { level: 0, bass: 0, mid: 0, high: 0, kick: 0 };
  private bassHistory = [NOISE_FLOOR_DB, NOISE_FLOOR_DB];
  private lastBassTarget = 0;
  private lastKick = -Infinity;

  constructor(sampleRate: number, settings: AnalysisSettings = DEFAULT_ANALYSIS) {
    this.sampleRate = sampleRate;
    this.hopSeconds = HOP_SIZE / sampleRate;
    this.settings = settings;
    for (let i = 0; i < FFT_SIZE; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE);
    this.bassLp = new Biquad('lowpass', 150, sampleRate);
    this.midHp = new Biquad('highpass', 150, sampleRate);
    this.midLp = new Biquad('lowpass', 2500, sampleRate);
    this.highHp = new Biquad('highpass', 2500, sampleRate);
  }

  setSettings(settings: AnalysisSettings): void {
    this.settings = settings;
  }

  /** Feed mono samples; returns a frame for every completed hop. */
  push(input: Float32Array): AnalysisFrame[] {
    const frames: AnalysisFrame[] = [];
    for (let i = 0; i < input.length; i++) {
      const x = Number.isFinite(input[i]) ? input[i] : 0;
      this.ring[this.ringPos] = x;
      this.ringPos = (this.ringPos + 1) % FFT_SIZE;
      const bass = this.bassLp.process(x);
      const mid = this.midLp.process(this.midHp.process(x));
      const high = this.highHp.process(x);
      this.sumSquares.level += x * x;
      this.sumSquares.bass += bass * bass;
      this.sumSquares.mid += mid * mid;
      this.sumSquares.high += high * high;
      this.samples++;
      if (++this.hopFill === HOP_SIZE) {
        this.hopFill = 0;
        frames.push(this.analyze());
      }
    }
    return frames;
  }

  private analyze(): AnalysisFrame {
    const { autoGain, gain, smoothing } = this.settings;
    const dt = this.hopSeconds;
    // Levels fall with a time constant of 20 ms … 520 ms
    const fall = Math.exp(-dt / (0.02 + 0.5 * clamp01(smoothing)));
    const levels: AudioLevels = { level: 0, bass: 0, mid: 0, high: 0, kick: 0 };

    const db: Record<Band, number> = { level: 0, bass: 0, mid: 0, high: 0 };
    let bassFlux = 0;
    for (const band of BANDS) {
      db[band] = toDb(Math.sqrt(this.sumSquares[band] / HOP_SIZE));
      this.sumSquares[band] = 0;
      this.peakDb[band] = Math.max(db[band], this.peakDb[band] - PEAK_FALL_DB_PER_S * dt, NOISE_FLOOR_DB);
      const target = autoGain
        ? (db[band] <= NOISE_FLOOR_DB ? 0 : clamp01((db[band] - (this.peakDb[band] - AUTO_RANGE_DB)) / AUTO_RANGE_DB))
        : clamp01((db[band] + gain + MANUAL_RANGE_DB) / MANUAL_RANGE_DB);
      if (band === 'bass') {
        bassFlux = Math.max(0, target - this.lastBassTarget);
        this.lastBassTarget = target;
      }
      const previous = this.smoothed[band];
      levels[band] = target >= previous ? target : target + (previous - target) * fall;
    }

    // Kick: a fast rise of the bass close to its recent peak
    const time = this.samples / this.sampleRate;
    const rise = db.bass - Math.min(this.bassHistory[0], this.bassHistory[1]);
    this.bassHistory = [this.bassHistory[1], db.bass];
    const loudEnough = db.bass > NOISE_FLOOR_DB + 12 && db.bass > this.peakDb.bass - KICK_NEAR_PEAK_DB;
    if (rise >= KICK_RISE_DB && loudEnough && time - this.lastKick >= KICK_MIN_INTERVAL_S) {
      this.lastKick = time;
      levels.kick = 1;
    } else {
      levels.kick = this.smoothed.kick * Math.exp(-dt / (0.06 + 0.2 * clamp01(smoothing)));
    }
    this.smoothed = levels;

    // Spectrum (windowed FFT of the last FFT_SIZE samples) and onset strength
    for (let i = 0; i < FFT_SIZE; i++) {
      this.re[i] = this.ring[(this.ringPos + i) % FFT_SIZE] * this.window[i];
      this.im[i] = 0;
    }
    this.fft.transform(this.re, this.im);
    const norm = 4 / FFT_SIZE; // a full-scale sine peaks at 1 (Hann window)
    const offset = autoGain ? -Math.max(this.peakDb.level, NOISE_FLOOR_DB + 24) : gain;
    const spectrum = new Uint8Array(SPECTRUM_SIZE);
    let flux = 0;
    const fluxBins = Math.min(SPECTRUM_SIZE, Math.round((8000 / this.sampleRate) * FFT_SIZE));
    for (let k = 0; k < SPECTRUM_SIZE; k++) {
      const mag = Math.hypot(this.re[k], this.im[k]) * norm;
      const logMag = Math.log1p(1000 * mag);
      if (k > 0 && k < fluxBins) flux += Math.max(0, logMag - this.logMag[k]);
      this.logMag[k] = logMag;
      const target = clamp01((20 * Math.log10(mag + 1e-12) + offset + SPECTRUM_RANGE_DB) / SPECTRUM_RANGE_DB);
      const previous = this.spectrumSmooth[k];
      const v = target >= previous ? target : target + (previous - target) * fall;
      this.spectrumSmooth[k] = v;
      spectrum[k] = Math.round(v * 255);
    }

    // The wave as heard (with the gain), 128 = silence
    const waveGain = autoGain ? 1 / Math.max(1e-3, 10 ** (this.peakDb.level / 20)) : 10 ** (gain / 20);
    const waveform = new Uint8Array(WAVEFORM_SIZE);
    const start = this.ringPos + FFT_SIZE - WAVEFORM_SIZE;
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      const x = this.ring[(start + i) % FFT_SIZE] * waveGain;
      waveform[i] = Math.round(clamp01(0.5 + 0.5 * x) * 255);
    }

    return { frame: this.samples, levels, flux: flux / Math.max(1, fluxBins - 1), bassFlux, spectrum, waveform };
  }
}
