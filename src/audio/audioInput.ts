import { createStore, useStore } from 'zustand';
import analyserUrl from './analyser.worklet.ts?worker&url';
import { DEFAULT_ANALYSIS, HOP_SIZE, type AnalysisFrame, type AnalysisSettings } from './analysis';
import type { AnalyserMessage } from './analyser.worklet';
import { TempoTracker, type TempoEstimate } from './tempo';
import { clearAudio, publishAudio, type AudioSnapshot } from './audioBus';
import { clockNow } from '../state/clock';
import { currentClock } from '../state/deckActions';
import { followTempo, syncToBeat } from '../state/clockActions';
import { postAudio } from '../output/controlSync';

// ---------------------------------------------------------------------------
// The editor's audio input (microphone, line in, loopback device): captured
// without echo cancellation, noise suppression or auto gain, analysed in an
// AudioWorklet, published to this window's renderers and forwarded to the
// output windows. The input and its settings belong to this machine, not
// to the project.
// ---------------------------------------------------------------------------

export type AudioInputStatus = 'off' | 'starting' | 'on' | 'error';

export interface AudioInputSettings extends AnalysisSettings {
  deviceId: string | null; // null: the system default
  enabled: boolean; // start again on the next visit
  follow: boolean; // the master tempo follows the detected tempo
}

export interface AudioDevice {
  id: string;
  label: string;
}

interface AudioInputState {
  status: AudioInputStatus;
  error: string | null;
  devices: AudioDevice[];
  settings: AudioInputSettings;
  tempo: TempoEstimate | null; // detected tempo (null: listening / nothing periodic)
}

const SETTINGS_KEY = 'video-mapper-audio';
const DEFAULT_SETTINGS: AudioInputSettings = { ...DEFAULT_ANALYSIS, deviceId: null, enabled: false, follow: false };
// Estimate the tempo every this many hops (~0.5 s)
const TEMPO_EVERY_HOPS = 48;

const loadSettings = (): AudioInputSettings => {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<AudioInputSettings>;
    return {
      gain: typeof raw.gain === 'number' && Number.isFinite(raw.gain) ? Math.max(-24, Math.min(36, raw.gain)) : DEFAULT_SETTINGS.gain,
      autoGain: typeof raw.autoGain === 'boolean' ? raw.autoGain : DEFAULT_SETTINGS.autoGain,
      smoothing: typeof raw.smoothing === 'number' ? Math.max(0, Math.min(1, raw.smoothing)) : DEFAULT_SETTINGS.smoothing,
      deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : null,
      enabled: raw.enabled === true,
      follow: raw.follow === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const audioInputStore = createStore<AudioInputState>()(() => ({
  status: 'off',
  error: null,
  devices: [],
  settings: loadSettings(),
  tempo: null,
}));

export function useAudioInput<T>(selector: (state: AudioInputState) => T): T {
  return useStore(audioInputStore, selector);
}

const saveSettings = (settings: AudioInputSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // not persisted — still applies now
  }
};

// ---- Session ------------------------------------------------------------------------------

interface Session {
  context: AudioContext;
  stream: MediaStream;
  node: AudioWorkletNode;
  tracker: TempoTracker;
  sampleRate: number;
  clockOffset: number | null; // clock time of sample 0 (audio clock → clock time base)
  hops: number;
  removeResume: () => void;
}

let session: Session | null = null;
let starting: Promise<void> | null = null;

const describeError = (error: unknown): string => {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Microphone access was denied — allow it in the browser’s site settings.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'That audio input is not available.';
  if (name === 'NotReadableError') return 'The audio input is in use by another application or could not be opened.';
  return (error as Error)?.message || 'The audio input could not be started.';
};

export const refreshDevices = async (): Promise<void> => {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const devices = list
      .filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d, i) => ({ id: d.deviceId, label: d.label || `Input ${i + 1}` }));
    audioInputStore.setState({ devices });
  } catch {
    // no list — the default input still works
  }
};

const onFrame = (s: Session, frame: AnalysisFrame) => {
  const now = clockNow();
  // Audio clock → clock time base: the least delayed message wins; creep
  // up slowly so the mapping follows if the two clocks drift apart
  const frameMs = (frame.frame / s.sampleRate) * 1000;
  const offset = now - frameMs;
  s.clockOffset = s.clockOffset === null || offset < s.clockOffset ? offset : s.clockOffset + 0.01;
  const snapshot: AudioSnapshot = { at: now, levels: frame.levels, spectrum: frame.spectrum, waveform: frame.waveform };
  publishAudio(snapshot);
  postAudio(snapshot);

  s.tracker.push(frame.flux, frame.bassFlux, s.clockOffset + frameMs);
  if (++s.hops % TEMPO_EVERY_HOPS === 0) {
    const tempo = s.tracker.estimate();
    audioInputStore.setState({ tempo });
    const detected = detectedTempo();
    if (detected && audioInputStore.getState().settings.follow) followTempo(detected);
  }
};

/** Start (or switch) the audio input. */
export const startAudioInput = async (deviceId = audioInputStore.getState().settings.deviceId): Promise<void> => {
  if (starting) await starting.catch(() => {});
  stopSession();
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    audioInputStore.setState({ status: 'error', error: 'This browser has no audio input for web pages.' });
    return;
  }
  audioInputStore.setState({ status: 'starting', error: null, tempo: null });
  starting = (async () => {
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          // Music, not a call: no processing that would flatten the dynamics
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      context = new AudioContext({ latencyHint: 'interactive' });
      await context.audioWorklet.addModule(analyserUrl);
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, 'video-mapper-analyser', { numberOfInputs: 1, numberOfOutputs: 1 });
      // The analyser outputs silence; connecting it keeps the graph running
      const mute = context.createGain();
      mute.gain.value = 0;
      source.connect(node);
      node.connect(mute);
      mute.connect(context.destination);

      const track = stream.getAudioTracks()[0];
      const settings = audioInputStore.getState().settings;
      const trackLatency = (track?.getSettings() as { latency?: number } | undefined)?.latency;
      const sampleRate = context.sampleRate;
      const hopMs = (HOP_SIZE / sampleRate) * 1000;
      // The beat was heard this long before its onset is measured
      const latencyMs = (typeof trackLatency === 'number' ? trackLatency * 1000 : 10) + 0.75 * hopMs;
      const s: Session = {
        context,
        stream,
        node,
        sampleRate,
        tracker: new TempoTracker(sampleRate / HOP_SIZE, { seconds: 10, latencyMs }),
        clockOffset: null,
        hops: 0,
        removeResume: () => {},
      };
      node.port.onmessage = (event: MessageEvent<AnalysisFrame>) => onFrame(s, event.data);
      node.port.postMessage({ settings: settingsOf(settings) } satisfies AnalyserMessage);

      // Without a click or key press first, browsers keep audio suspended
      if (context.state !== 'running') {
        const resume = () => void context?.resume();
        window.addEventListener('pointerdown', resume, true);
        window.addEventListener('keydown', resume, true);
        s.removeResume = () => {
          window.removeEventListener('pointerdown', resume, true);
          window.removeEventListener('keydown', resume, true);
        };
        void context.resume();
      }
      track?.addEventListener('ended', () => {
        if (session !== s) return;
        stopSession();
        audioInputStore.setState({ status: 'error', error: 'The audio input was disconnected.' });
      });

      session = s;
      const usedId = track?.getSettings().deviceId ?? deviceId;
      updateSettings({ deviceId: deviceId ? usedId ?? deviceId : null, enabled: true });
      audioInputStore.setState({ status: 'on', error: null });
      void refreshDevices(); // labels are only there after permission
    } catch (error) {
      stream?.getTracks().forEach(t => t.stop());
      void context?.close();
      audioInputStore.setState({ status: 'error', error: describeError(error) });
    }
  })();
  await starting;
  starting = null;
};

const stopSession = () => {
  const s = session;
  session = null;
  if (!s) return;
  s.removeResume();
  s.node.port.onmessage = null;
  s.stream.getTracks().forEach(t => t.stop());
  void s.context.close();
  clearAudio();
};

export const stopAudioInput = (): void => {
  stopSession();
  updateSettings({ enabled: false });
  audioInputStore.setState({ status: 'off', error: null, tempo: null });
};

const settingsOf = ({ gain, autoGain, smoothing }: AnalysisSettings): AnalysisSettings => ({ gain, autoGain, smoothing });

export const updateSettings = (patch: Partial<AudioInputSettings>): void => {
  const settings = { ...audioInputStore.getState().settings, ...patch };
  audioInputStore.setState({ settings });
  saveSettings(settings);
  session?.node.port.postMessage({ settings: settingsOf(settings) } satisfies AnalyserMessage);
};

/** On load: start the input again if it was on (the permission is remembered). */
export const resumeAudioInput = (): void => {
  if (audioInputStore.getState().settings.enabled && !session && !starting) void startAudioInput();
};

/** The detected tempo, in the octave closest to the master tempo. */
export const detectedTempo = (): TempoEstimate | null => {
  const tempo = audioInputStore.getState().tempo;
  if (!tempo) return null;
  const current = currentClock().bpm;
  const options = [tempo.bpm / 2, tempo.bpm, tempo.bpm * 2];
  const nearest = options.reduce((a, b) => (Math.abs(Math.log2(b / current)) < Math.abs(Math.log2(a / current)) ? b : a));
  // Only take another octave when the master is close to it (the operator chose it)
  const bpm = Math.abs(nearest / current - 1) < 0.1 ? nearest : tempo.bpm;
  return { ...tempo, bpm: Math.round(bpm * 10) / 10 };
};

/** Take the detected tempo, with the beat where the music has it. */
export const syncToDetectedTempo = (): boolean => {
  const tempo = detectedTempo();
  if (!tempo) return false;
  syncToBeat(tempo.bpm, tempo.beatTime);
  return true;
};
