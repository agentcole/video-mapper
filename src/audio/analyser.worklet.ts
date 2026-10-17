import { AudioAnalyzer, DEFAULT_ANALYSIS, type AnalysisSettings } from './analysis';

// ---------------------------------------------------------------------------
// AudioWorklet: analyses the audio input on the audio thread and posts one
// frame per hop (~94 per second at 48 kHz) to the editor. Runs whether or
// not the editor window is visible — timers and animation frames of a hidden
// window are throttled, the audio thread isn't.
// ---------------------------------------------------------------------------

// AudioWorkletGlobalScope (not in the DOM typings)
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

export interface AnalyserMessage {
  settings?: AnalysisSettings;
}

class AnalyserProcessor extends AudioWorkletProcessor {
  private analyzer = new AudioAnalyzer(sampleRate, DEFAULT_ANALYSIS);
  private mono = new Float32Array(128);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<AnalyserMessage>) => {
      if (event.data.settings) this.analyzer.setSettings(event.data.settings);
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    const length = channels[0].length;
    if (this.mono.length !== length) this.mono = new Float32Array(length);
    // Mono: the average of all channels
    this.mono.fill(0);
    for (const channel of channels) {
      for (let i = 0; i < length; i++) this.mono[i] += channel[i] / channels.length;
    }
    for (const frame of this.analyzer.push(this.mono)) {
      this.port.postMessage(frame, [frame.spectrum.buffer, frame.waveform.buffer]);
    }
    return true;
  }
}

registerProcessor('video-mapper-analyser', AnalyserProcessor);
