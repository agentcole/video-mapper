# Modulation, audio input and macros (roadmap 2.5)

Status: implemented in project format 5.5.0. Modulation renders with the GPU renderer, like effects ([effects.md](effects.md)). Builds on the master clock ([master-clock.md](master-clock.md)).

## Model

A **modulation** moves one parameter: a **source** gives 0..1, and the parameter is pushed from where it is set by `amount` (−1..1) of its range, then clamped (`src/state/modulation.ts`, pure and tested):

```
value = clamp(base + amount · (max − min) · source, min, max)
```

| Source | Value |
|---|---|
| **LFO** | Sine, Triangle, Saw up, Ramp down, Square, Pulse, Random (sample & hold). Period in beats of the master clock (1/16 … 8 bars) or seconds (0.25–60 s), phase 0..1, width (square duty cycle / pulse decay). Waves peak on the cycle start, so a beat-synced LFO hits on the beat |
| **Audio** | Level, Bass, Mid, High, Kick of the audio input |
| **Macro** | One of 8 macro faders of the composition |

- **What can be modulated:** float parameters and each axis of point parameters of every effect and generator (`EffectInstance.mods`, `GeneratorSettings.mods`, keyed by input name or `name.0` / `name.1`), and the layer opacity (`Layer.mods.opacity`). One modulation per parameter.
- **Same picture everywhere:** LFOs come from the shared clock time base, macros are part of the project (mirrored to outputs), and the audio analysis is forwarded to output windows. Random LFOs are seeded per parameter, so every window draws the same values. No per-frame values are sent.
- **Renderer:** the GPU compositor builds a modulation context once per frame (clock, audio, macros), applies it to effect and generator parameters before they reach the shader, and to layer opacity before the crossfader gain. Frames with modulation redraw every animation frame. The CSS renderer ignores modulation; the editor says so.
- **Saving:** modulations are document edits (undoable). Macro values are saved with the project but not undoable — like the tempo, they are performance controls.

## Audio input (`src/audio/`)

- **Capture:** `getUserMedia` with echo cancellation, noise suppression and auto gain **off** (music, not a call). Any input works: microphone, line in, or a loopback device (BlackHole, VB-Cable) for the DJ's or a player's sound. The device and settings belong to the machine (localStorage), not the project; an input that was on starts again on the next visit (browsers remember the permission). A disconnected device is reported.
- **Analysis on the audio thread:** an AudioWorklet (`analyser.worklet.ts`, `analysis.ts`) analyses every hop of 512 samples (~94 per second at 48 kHz), whether or not the editor window is visible:
  - **Level** and three **bands** — bass < 150 Hz, mid 150 Hz–2.5 kHz, high > 2.5 kHz — from IIR filters (RMS per hop, so a kick shows within ~10 ms), mapped from dB to 0..1. **Manual gain:** 0 dBFS is 1, the range is 36 dB, gain shifts it. **Auto gain** (default): each band follows its own recent peak (falling 2 dB/s) and maps the 24 dB below it — every band reaches 1 on its loudest moments, whatever the room level. Levels rise at once and fall with the **smoothing** time (20–520 ms).
  - **Kick:** the bass rising ≥ 6 dB within two hops, within 18 dB of its recent peak, at most every 100 ms → 1, then decays.
  - **Spectrum** (1024-point FFT, Hann window, 512 bins 0 Hz–Nyquist) and the last 512 samples of the wave, as bytes.
- **Sharing:** the editor publishes each analysis to its renderers (`audioBus.ts`) and forwards it over the output channel (only while output windows are connected, ~1 KB per message). An analysis older than 500 ms counts as silence, so outputs go quiet when the input stops.
- **ISF audio inputs:** `audio` (waveform, 0.5 = silence) and `audioFFT` (spectrum, 0..1) inputs get the analysis as one-row images, resampled to the input's `MAX` columns when it has one (FFT: the loudest bin of each group). Two bundled generators use them: **Spectrum** (log-frequency bars) and **Waveform** (oscilloscope line).

## Tempo from audio (`src/audio/tempo.ts`)

- Listens to the onsets of the last 10 s: the rise of the bass (the kick) plus 0.3 × the spectral flux below 8 kHz, smoothed over a few hops. The autocorrelation at one to four beat periods scores 60–200 BPM (0.05 BPM steps) with a prior around 120 BPM; a comb over the **bass** onsets finds where the beats fall (on the kick, not the hi-hats), and a least-squares fit through the onset peaks sharpens tempo and phase like tap tempo does. Onsets are measured ~0.75 hop after the sound (plus the input latency), which is compensated.
- An estimate every ~0.5 s; it is **steady** when the last three agree within 1 BPM. Like any beat tracker it can't know the downbeat, and half/double time stays the operator's call (drum & bass reads as 87). The detected tempo is shown in the octave closest to the master tempo when the master is within 10 % of it (after ÷2 / ×2).
- **Sync:** take the detected tempo and move the beat grid onto the detected beat, counting bars on from the nearest beat (`alignClock`, shift ≤ half a beat). The bar start stays the operator's — Resync if needed.
- **Follow:** while the estimate is steady and confident (≥ 50 %), the master follows when it is off by ≥ 0.2 BPM or ≥ 25 ms, at most every 2 s.

## Editor

- **Audio** chip in the launcher toolbar: mini meter and detected tempo; opens **Audio & Macros** (input device, on/off, meters for the five bands, spectrum, auto gain / gain, smoothing, tempo with Sync and Follow, and the 8 macro faders — double-click a name to rename).
- **∿** next to every number parameter in the effect editor adds a modulation (new ones move towards the side with room: down from the top half of the range) and opens its editor: source, LFO shape / period / phase / width, amount. A cyan marker on the slider shows the modulated value live; effects with modulation show ∿ in their header.
- **Layer opacity:** right-click the layer header → *Opacity modulation*; the opacity slider shows the live marker.

## Measured / tested

- Unit tests (synthetic loops of kicks and hi-hats, 48 kHz): bands separate tones, gain mapping, auto gain, smoothing, every kick detected once within two hops; tempo exact to 0.1 BPM for 90–150 BPM with the beat < 5 ms from the kick, with and without hi-hats; noise has no confidence; modulation math, labels, schema and actions.
- Chrome (automated test browser, a synthetic 128 BPM loop as the input): AudioWorklet analysis running, tempo 128.0 steady after ~4 s, detected beats 0.3–2.8 ms from the kicks, after Sync the master beat 0.9 ms from them; a kick-modulated layer's rendered pixels follow the kick level exactly; a beat LFO on Hue Shift cycles the colour through the bar and the live marker moves 25 → 75 → 25 %; a macro moved in the editor changes the picture in the output window; the output window gets each analysis ~8 ms after it was measured; Spectrum and Waveform generators draw from the audio; 44/44 bundled shaders compile; no console errors.
- **Not yet tested with real music** (bass lines under the kick, breakbeats, a noisy room) or on show hardware — the kick and tempo thresholds may need tuning there.

## Next

- MIDI learn for macros and parameters, MIDI clock (2.6).
- Modulation of more targets (clip look, crossfader, master, playback speed), several modulations per parameter, response curves.
- Audio of playing clips as a source; Ableton Link (companion, 4.4).
