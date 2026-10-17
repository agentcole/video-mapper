# Effects and generators (roadmap 2.4)

Status: implemented in project format 5.4.0, GPU renderer only. Effects and generators are **ISF** shaders ([isf.video](https://isf.video)), the interchange format of VDMX, Resolume Wire, Synesthesia and many shader collections.

## What there is

- **Effect stacks** on a **clip**, a **layer** and the **composition**. Order of processing: clip stack → layer stack (per clip, so a dissolve mixes two processed clips) → frame look (CSS-style filters, flip, zoom) → blend into the composition → composition stack on the whole picture → master fader.
- **Generators**: a clip can be an ISF generator instead of a media file (media picker → *Generators*). It renders at the composition size (capped at 2048 px) and surfaces show their part of it like media; effects stack on top.
- **Library:** 42 bundled shaders written for this project (MIT, `src/effects/isf/*.fs`) — 31 effects (Beat, Blur, Color, Distort, Feedback, Key, Stylize) and 11 generators (incl. colour bars and a grid for projector alignment) — plus **imported ISF files** (effect picker → upload icon). Imports live in IndexedDB (`video-mapper-effects`), shared by every window of the browser, keyed by a hash of their text (importing a file twice gives one entry). Project files and packages carry the imported shaders they use (`shaders` in project.json), so a project opens complete in another browser.
- **Editor:** *Effects…* in the clip menu, *Layer effects…* in the layer menu or the `fx` chip on the layer header, *FX* in the launcher toolbar for the composition. Each effect can be bypassed, reordered, reset and removed; parameters get sliders, colour pickers, selects, toggles and x/y sliders from the ISF inputs. Clips and layers with effects show an `fx` badge. In CSS mode the panel offers to switch to the GPU renderer, and generator surfaces say they need it.
- **Beat sync:** besides the ISF built-ins (TIME, TIMEDELTA, FRAMEINDEX, DATE, RENDERSIZE, PASSINDEX) shaders get `BPM` and `BEAT` (beats of the master clock, see [master-clock.md](master-clock.md)). Strobe, Beat Zoom, Shake, RGB Split (pulse), Radial Gradient, Stripes, Rings and Sweep use them. TIME counts from the editor session start and is mirrored to output windows, so editor and projector animate in step.

## ISF support (`src/effects/isf.ts`)

- Parses the JSON header (trailing commas tolerated), translates the GLSL to GLSL ES 3.00: `gl_FragColor`, `texture2D`, `varying`, `vv_FragNormCoord`, and the ISF macros (`IMG_PIXEL`, `IMG_NORM_PIXEL`, `IMG_THIS_PIXEL`, `IMG_THIS_NORM_PIXEL`, `IMG_SIZE`). `#line` keeps compile errors on the file's line numbers.
- Inputs: float, bool, long (VALUES/LABELS), color, point2D, event (as a bool), image (`inputImage`; others are black). Audio inputs are bound to silence until 2.5.
- Multi-pass with named targets, `PERSISTENT` buffers (feedback), `FLOAT` targets (half float when the GPU can render to it) and size expressions (`$WIDTH/2`, `floor(…)`, input values).
- Not supported: custom vertex shaders, `IMPORTED` images, `texture2DRect`.
- Kinds: an effect has `inputImage`, a transition has `startImage` + `endImage` (recognised, not yet used — 2.3's dissolve is the only transition), everything else is a generator.

## GPU pipeline (`src/render/webgl/EffectRunner.ts`)

- One program per shader version (id + content hash), compiled on first use; compile errors are reported to the library and shown in the effect editor.
- Every stack owns its render targets (double-buffered, keyed by stack + effect instance + pass target), so passes read the previous result and never the texture they write; unused targets are freed after ~2 s.
- **Orientation:** ISF puts (0,0) at the bottom left. Media textures are top row first, so the first pass reads them through `_inputImage_flip`; everything the runner renders is bottom-up and the frame shader samples it with `Look.yUp`. The composition stack reads the compositor's target (already bottom-up).
- The compositor resolves all frames' content (generators, effect stacks) before compositing, then runs the composition stack and presents. Frames are redrawn every animation frame while any effect or generator is active.
- `?isf-check` compiles and runs every shader of the library in the current browser (for shader authors). In Chrome all 42 bundled shaders compile and run.

## Measured / tested

Chrome (automated test browser): Plasma generator with a Kaleidoscope on top; Invert + two-pass Blur on a video clip (text stays upright); Feedback (persistent buffer) + Vignette on the composition with a beat-synced Sweep generator — trails visible; an imported `.fs` file (Channel Swap) applied to a clip and picked up by an already open output window; CSS mode shows the generator hint and the switch-to-GPU notice; no console errors.

## Next

- Audio inputs (`audio`, `audioFFT`) and modulation of effect parameters by LFO / FFT / beat (2.5); MIDI mapping of parameters (2.6).
- ISF transitions as layer transitions (wipes, slides) at the dissolve mix point.
- Effect presets and dry/wet per effect; per-effect GPU timing in the editor.
