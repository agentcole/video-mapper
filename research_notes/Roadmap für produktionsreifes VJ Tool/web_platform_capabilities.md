# Web Platform & Desktop-Wrapper Capabilities for a Production-Ready Browser VJ / Projection-Mapping Tool (state: 2026-10-15)

> **How to read these notes.** Research date: **2026-10-15**. Browser-support data comes from MDN's browser-compat-data (BCD) **v8.1.6, generated 2026-10-15T13:35:41Z**, downloaded from [BCD 8.1.6 data.json](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json). The MDN "Browser compatibility" tables are rendered from this same data. "BCD" in the bullets below means this file. Unless a bullet says otherwise, the browser versions are the ones BCD lists as the first version with the feature.
> Current stable versions according to BCD on 2026-10-15: **Chrome 155** (released 2026-10-06), **Edge 155** (2026-10-08), **Firefox 158** (2026-10-13), **Safari/iOS Safari 27** (2026-09-14), with Safari 27.2 in beta ([BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)).
> Library versions and activity were read from the GitHub API on 2026-10-15.
> **Limitation:** the session's web-search budget ran out partway through. Some sub-topics (aubio-wasm, multi-monitor vsync internals, Open Stage Control's packaging, Safari codec matrix) could not be checked further, and they are listed under Gaps.

## 1. Rendering: WebGPU/WebGL2 status, video→GPU import, render libraries, warp/blend/shader techniques

### Takeaway
As of October 2026, WebGPU ships by default in Chrome/Edge (Windows, macOS, ChromeOS, Android, and some Linux), Safari 26+ (macOS/iOS/iPadOS/visionOS) and Firefox (Windows; Apple-silicon Macs). It is still missing or flag-gated in Firefox on Linux and Intel Macs, on most Linux GPUs in Chrome, and on Windows-on-ARM Chrome. A WebGL2 fallback is therefore still required. For video, the zero-copy path is `importExternalTexture`. It works in Chrome and Safari, but Firefox has it on Windows only. Three.js `WebGPURenderer` with TSL is the most practical "WebGPU with automatic WebGL2 fallback" library. Mesh/Bezier warp, edge blending and ISF-style effects are all ordinary shader work that WebGPU and WebGL2 can do.

### Cited Findings
**WebGPU support per browser and platform (2026-10-15)**
- Chrome/Edge: BCD records WebGPU (`api.GPU`) as partial from **113** ("Supported on ChromeOS, macOS, and Windows"). It becomes full from **144** ("Supported on ChromeOS, macOS, Windows, and Linux (Intel Gen12+ GPUs only)"). Chrome Android is listed from **121** — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- The gpuweb Implementation Status wiki (last edited 2026-10-02) gives more detail for Chromium:
  - Mac, Windows (x86/x64) and ChromeOS from 113.
  - Android 12+ on ARM/Qualcomm/Intel GPUs from 121, and Imagination GPUs on Android 16+ from 139. Samsung Xclipse is "in progress".
  - **Linux Intel Gen12+ from 144**, and **Linux NVIDIA (driver ≥535.183.01, Wayland) from 147**. Other Linux GPUs are "behind a flag" (`--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`).
  - **Windows ARM64 is behind a flag** — [gpuweb wiki: Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- Firefox: BCD notes say:
  - "Supports Windows since Firefox 141".
  - "Supports macOS Tahoe on Apple silicon since Firefox 145".
  - "Supports older macOS versions on Apple silicon since Firefox 147".
  - "**Does not support macOS on Intel CPUs** (bug 2004105)" and "**Does not support Linux** (bug 2006676)".
  - "all contexts except service workers" — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Firefox 147 release notes (2026-01-13): "WebGPU support is now enabled for devices with Apple Silicon processors on all supported macOS versions." — [Firefox 147 release notes](https://www.firefox.com/firefox/147.0/releasenotes/)
- Firefox Linux: the gpuweb wiki lists it as "Nightly only … Mozilla expects to ship in 2026", and Android as "behind a flag" — [gpuweb wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status). A gpuweb issue opened 2026-07-09 says the Firefox 152 release channel on Linux has WebGPU behind `dom.webgpu.enabled` in about:config — [gpuweb issue #6331](https://github.com/gpuweb/gpuweb/issues/6331)
- Safari: "WebKit for Safari 26.0 adds support for WebGPU" on macOS, iOS, iPadOS and visionOS. WebKit also says "WebGPU supersedes WebGL on macOS, iOS, iPadOS, and visionOS and is preferred for new sites and web apps" — [WebKit: Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). BCD lists Safari and iOS Safari 26 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Safari 27.0 (blog post 2026-09-17):
  - Adds WGSL `clip_distances`.
  - Fixes `GPUDevice.onuncapturederror`, which had not been working.
  - Restores `maxStorageBuffersInFragmentStage` and related limits.
  - Fixes MSAA resolve render passes on direct `GPUTexture`s.
  - [WebKit: Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- The web.dev post "WebGPU is now supported in major browsers" (2025-11-25) has the same matrix as above and lists Linux, Android Firefox and Intel-Mac Firefox as "in progress" — [web.dev](https://web.dev/blog/webgpu-supported-major-browsers)
- Production caveats from a 2026-04-29 industry article:
  - A WebGL2 fallback is still needed for Linux Firefox and for iPhones older than A12.
  - In-app browsers (Instagram, X, LINE, Facebook) "may fail adapter requests or drop GPU extensions".
  - Cold shader compilation can exceed 200 ms, so the article advises caching and warming pipelines.
  - [Utsubo: Frontier Web APIs 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)

**WebGL2 fallback**
- WebGL2 is available in Chrome 56, Edge 79, Firefox 51 and Safari 15 (iOS 15) — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Safari 27 fixes "some WebGL context state properties not being correctly reset on context loss". It also fixes a regression where "a WebGL canvas was filled with opaque content that hid stacked canvases beneath it" — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

**Getting video frames onto the GPU**
- `GPUDevice.importExternalTexture()` support:
  - Chrome 113 (partial) / 144 (with Linux Intel Gen12+).
  - **Firefox 144, "Supported on Windows only"**.
  - Safari 26.
  - Passing a `VideoFrame` as the source: Chrome 116, Firefox 144, Safari 26.
  - Passing `colorSpace: "display-p3"`: **Chrome only** (121/144); not Firefox or Safari.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json); MDN page: [GPUDevice.importExternalTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/importExternalTexture)
- `GPUQueue.copyExternalImageToTexture()` is in Chrome 113/144, Firefox 141 (same platform limits as WebGPU) and Safari 26 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- How `importExternalTexture` behaves (Toji's WebGPU best-practices page):
  - It is the video fast path. It avoids a copy, but the texture "can't … have its contents changed, copied from, or otherwise manipulated."
  - Shaders must declare `texture_external` and sample with `textureSampleBaseClampToEdge()`.
  - External textures **expire as a microtask**, so the rules are: import and draw in the same callback, never `await` between import and draw, and create a new bind group every frame.
  - [Toji: WebGPU `<img>`, `<canvas>`, and `<video>` Textures](https://toji.dev/webgpu-best-practices/img-textures.html)
- `HTMLVideoElement.requestVideoFrameCallback()` is in Chrome 83, Edge 83, **Firefox 132**, Safari 15.4 (iOS 15.4) — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- `OffscreenCanvas` and `transferControlToOffscreen` are in Chrome 69, Firefox 105, Safari 16.4. That means rendering can move to a worker in every engine — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- WebGPU canvas context (`getContext('webgpu')`): BCD notes for Firefox say "Supported on Windows only" from 141. This note is narrower than the general `GPU` note, which includes macOS. Treat it as a BCD inconsistency and test on Firefox macOS — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)

**One GPU device driving many canvases**
- "WebGPU supports rendering into multiple canvases from a single Device", and each presentation context owns its own `GPUCanvasContext` — [luma.gl: multiple canvases](https://luma.gl/docs/developer-guide/multiple-canvases)
- A 2020 gpuweb mailing-list thread reports that one adapter+device per canvas was very costly. A spec editor replied that the spec "will support single device with many workers and many canvases" — [public-gpu 2020-04](https://lists.w3.org/Archives/Public/public-gpu/2020Apr/0016.html)

**Render libraries (versions as of 2026-10-15 via the GitHub API)**
- three.js: latest release **r186** (2026-09-24), still actively pushed — [GitHub mrdoob/three.js](https://github.com/mrdoob/three.js)
- The three.js manual (quoted in search results) says: "If a device/browser doesn't support WebGPU, the renderer can automatically fall back to using a WebGL 2 backend." A direct fetch of the page returned HTTP 404 on 2026-10-15, so the quote could not be re-read in full — [three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html)
- TSL is "transpiled at runtime, your browser will execute either GLSL or WGSL depending on the capabilities of your browser" — [sbcode: WebGPU renderer](https://sbcode.net/threejs/webgpu-renderer/)
- Known fallback bug: `copyTextureToTexture` with a render target does not work on the WebGL fallback of `WebGPURenderer`. The reporter tested r170 and r180 — [three.js issue #31950](https://github.com/mrdoob/three.js/issues/31950)
- PixiJS: latest **v8.22.0** (2026-10-01) — [GitHub pixijs/pixijs](https://github.com/pixijs/pixijs)
- The PixiJS v8 launch post warns that "WebGPU does not automatically guarantee improved performance over WebGL in all scenarios," because PixiJS is often CPU-bound. WebGPU helps most with many batch breaks (filters, masks, blend modes) — [PixiJS v8 launch](https://pixijs.com/blog/pixi-v8-launches)
- PixiJS v8 beta notes say texture swaps on batched elements push a scene from "fast mode" into "regular mode" — [PixiJS v8.0.0-beta.0](https://github.com/pixijs/pixijs/releases/tag/v8.0.0-beta.0)
- regl ("Functional WebGL") was last pushed 2026-09-08, with no GitHub releases. OGL ("Minimal WebGL Library") was last pushed 2025-04-13 — [GitHub regl-project/regl](https://github.com/regl-project/regl); [GitHub oframe/ogl](https://github.com/oframe/ogl)

**ISF (Interactive Shader Format) in the browser**
- `interactive-shader-format-js` (ISF-JS-Renderer):
  - Gets its context with `canvas.getContext("webgl")`.
  - API: `ISFRenderer(gl)`, `loadSource`, `setValue` (accepts image/video elements), `pushTextures`, `draw`. `ISFParser` converts ISF to GLSL and exposes `inputs`.
  - 107 stars, no releases, last pushed 2025-12-31.
  - WebGPU is not mentioned.
  - [GitHub msfeldstein/interactive-shader-format-js](https://github.com/msfeldstein/interactive-shader-format-js)
- "WGSL Shader Studio" describes itself as a WebGPU shader GUI with ISF import/export — [GitHub compiling-org/WGSL-Shader-Studio](https://github.com/compiling-org/WGSL-Shader-Studio)

**Edge blending and gamma**
- Paul Bourke's blend function (2004) for the normalised overlap `x` in [0,1]:
  - f(x) = 0.5·(2x)^p for x ≤ 0.5, and 1 − 0.5·(2(1−x))^p for x ≥ 0.5. With p = 1 the blend is linear, and the article uses p = 2.
  - Gamma compensation: right image = f(x)^(1/G), left image = f(1−x)^(1/G), with G typically 1.8–2.2.
  - Apply it **per R, G, B channel**, because projectors differ.
  - [Paul Bourke: Edge blending using commodity projectors](https://paulbourke.net/miscellaneous/edgeblend/)
- Immersaview frames the blend as a gamma ramp, o = i^γ. It advises that "A larger overlap region, blended with a lower gamma value will produce the best blends" — [Immersaview Edge Blending](https://immersaview.com/resources/edge-blending)
- TouchDesigner's `projectorBlend` palette component is based on Bourke's paper — [Derivative: projectorBlend](https://docs.derivative.ca/Palette:projectorBlend)

### Inferences
- **Use WebGPU first, with WebGL2 as fallback.** Writing the compositor directly against both APIs doubles shader work. Three.js `WebGPURenderer` with TSL node materials, or a thin custom abstraction, lets one shader graph target WGSL and GLSL. The cost is TSL lock-in and some fallback bugs (see #31950).
- **Video path:**
  - Where `importExternalTexture` exists (Chrome, Safari, Firefox on Windows), import each `<video>` or `VideoFrame` every frame inside the render callback.
  - Elsewhere, fall back to `copyExternalImageToTexture`, which costs one GPU copy per frame.
  - On WebGL2, the equivalent is `texImage2D(video)` / `texSubImage2D`.
  - Use `requestVideoFrameCallback` to upload only when a new decoded frame exists. This avoids redundant copies when the video is 25/30 fps and the display is 60/120 Hz.
- **Mesh warp.** Replace the matrix3d corner-pin with a subdivided grid mesh (N×M vertices) whose vertex positions the user drags. UVs stay regular. Use homogeneous (projective) UV interpolation for the 4-corner case so the warp is perspective-correct. Bezier warp means evaluating a bicubic Bezier patch or Catmull-Rom surface on the CPU (or in a compute or vertex shader) into that same dense mesh.
- **Masks.** Draw `clip-path` masks as GPU masks: stencil, or an alpha texture rasterised from vector paths.
- **Edge blend.** Implement it as a per-output post-pass on a full-screen quad: multiply by `pow(f(x), 1/gamma)` per channel, with a black-level lift for overlap areas.
- **ISF.** ISF is GLSL-based. Two options:
  - Run ISF shaders on the WebGL2 path by translating the ISF JSON header into uniforms.
  - Convert GLSL→WGSL (for example with naga or tint compiled to WASM — not verified in this research) for the WebGPU path.
  - Either way, an ISF→TSL or ISF→WGSL converter is custom engineering; no maintained WebGPU ISF runtime was found.

### Gaps
- The WebGPU features browsers expose to WKWebView embedders (Tauri on macOS) were not confirmed. WebKit's Safari 26 post talks about Safari, not WKWebView specifically.
- No benchmark was found for "N simultaneous videos → WebGPU" (for example, how many 1080p/4K H.264 streams Chrome or Safari can import per frame). This has to be measured on the target hardware.
- The three.js manual page could not be fetched (404). The claim that it is "production-ready" rests on blog posts of mixed quality.
- No sourced reference implementation of Bezier/mesh warp in WebGPU was gathered. The warp approach above is engineering inference.

## 2. Video decoding & codecs: WebCodecs, demuxing, codec matrix, HAP, ProRes, decoder limits, recording

### Takeaway
WebCodecs `VideoDecoder`/`VideoEncoder`/`VideoFrame` are in all three engines on desktop (Chrome 94, Firefox 130, Safari 16.4; Safari audio codecs since 26). With a WASM or TS demuxer (Mediabunny, mp4box.js, web-demuxer), this makes frame-accurate, clock-driven playback possible, which `<video>` cannot reliably give. H.264 and VP9 decode almost everywhere. AV1 decode is ~88–90%, and HEVC ~74% (in Chrome it depends on the platform's hardware). **ProRes and HAP have no native browser decoders:**
- ProRes needs a WASM decoder (Mediabunny's TurboRes extension).
- HAP would have to be custom-built: Snappy decompression in JS/WASM, then upload as DXT/BC compressed textures. That is feasible on desktop GPUs, but no maintained browser HAP player was found.

### Cited Findings
**WebCodecs support (2026-10-15)**
- `VideoDecoder`, `VideoEncoder` and `VideoFrame`: Chrome/Edge 94, Firefox 130, Safari 16.4 (iOS 16.4), Chrome Android 94 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- `AudioDecoder`: Chrome 94, Firefox 130, Safari **26** — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json). Safari 26 "expands support for WebCodecs API by adding AudioEncoder and AudioDecoder" — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- `ImageDecoder`: Chrome 94, Firefox 133, Safari "preview" only; not on iOS — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Firefox for Android has no WebCodecs — [Utsubo 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)
- Safari 27.0 changes:
  - "lets you override the color space a hardware `VideoDecoder` uses".
  - Fixes "an issue where the WebCodecs `VideoDecoder` API output frames in an incorrect order for videos containing B-frames".
  - Fixes I420 BT.709 frames being encoded in the wrong colour space for VP9.
  - [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- WebCodecs is available in dedicated workers — [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)

**Seeking and frame accuracy**
- "The first chunk decoded by a new decoder must be a keyframe" (German MDN guide). Seeking therefore means feeding from the previous keyframe and decoding forward — [MDN (de): Using the WebCodecs API](https://developer.mozilla.org/de/docs/Web/API/WebCodecs_API/Using_the_WebCodecs_API)
- Mediabunny's `VideoSampleSink.getSample(t)` returns "the last sample with a timestamp less than or equal to the search timestamp".
- `samplesAtTimestamps` "avoids decoding the same packet twice". Samples must be closed with `sample.close()`.
- Mediabunny recommends a canvas pool that "keeps the amount of allocated VRAM constant".
- [Mediabunny: Media sinks](https://mediabunny.dev/guide/media-sinks)

**Demuxers**
- Mediabunny:
  - v1.61.4 (2026-10-12), 7.3k stars, "Pure TypeScript media toolkit" — [GitHub Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny)
  - Reads and writes MP4/MOV/CMAF/MKV/WebM/Ogg/MP3/WAV/ADTS/FLAC/MPEG-TS/HLS.
  - Video codecs: AVC, HEVC, VP8, VP9, AV1 and Apple ProRes (ProRes via an extension). Codec availability depends on the browser's WebCodecs.
  - [Mediabunny: Supported formats & codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)
- mp4box.js v2.4.1 (2026-06-19), active (last pushed 2026-09-23); MP4 only — [GitHub gpac/mp4box.js](https://github.com/gpac/mp4box.js)
- web-demuxer 4.0.0 (2025-12-20) is WASM. It handles "mov/mp4/mkv/webm/flv/m4v/wmv/avi/ts", is "designed for WebCodecs", and needs its `.wasm` served statically — [GitHub bilibili/web-demuxer](https://github.com/bilibili/web-demuxer)

**Codec support**
- MDN's WebCodecs codec-selection page (last modified 2026-08-12) quotes global codec-string support from webcodecsfundamentals.org:
  - H.264 Baseline 720p: 99.6%
  - H.264 Main 4K: 98.9%
  - VP9 2K: 99.96%
  - AV1 720p: 87.9%
  - HEVC 1080p: 73.6%
- The same page says:
  - AV1 encode is "strong across desktop browsers but limited on Safari and on Android".
  - HEVC has "significant gaps in browser encoding support outside of Apple platforms".
  - **Firefox does not support AAC encoding on any platform; no browser on desktop Linux encodes AAC; Safari 26+ encodes AAC.**
  - [MDN: Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)
- HEVC in Chrome WebCodecs: "HEVC (encode and decode) is already supported in WebCodecs". HEVC platform encoding arrived in M130. "The support is currently limited to Windows, macOS and Android hosts" (blink-dev, Feb 2025) — [blink-dev: H26x Codec support updates for MediaRecorder](https://groups.google.com/a/chromium.org/g/blink-dev/c/YJ1QijNiHeM/m/3EhMjMVwAgAJ)
- Chromium HEVC hardware decode by platform:
  - macOS 11+ and Windows 8+.
  - Linux from Chrome 108 and ChromeOS, both VA-API only (e.g. Intel).
  - WebCodecs 8-bit decode from 107, 10-bit from 108.
  - Apple Silicon decodes HEVC Rext 4:2:2/4:4:4 8/10-bit in hardware.
  - NVIDIA Rext 8–12-bit decode from Chrome 137 (driver ≥572.16).
  - HEVC encode resolution reaches 7680×4320 on Windows (Chrome ≥131) and 8192×4352 at 120 fps on Apple Silicon.
  - [GitHub StaZhu/enable-chromium-hevc-hardware-decoding](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding)
- Firefox HEVC: Mozilla's support page lists "H.265 in MP4: Firefox 120+ (limited)", Windows 10+ only; macOS and Linux unsupported; 10-bit HDR HEVC "won't render properly" — [Mozilla Support: Audio and video in Firefox](https://support.mozilla.org/en-US/kb/audio-and-video-firefox). This conflicts with [StaZhu](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding), which says "Firefox >= 133 enables HEVC decoding support by default (Windows platform only)". Both agree it is Windows-only.
- AV1 encode via WebCodecs is "Chrome-only in 2026". The same article says HEVC encode needs a platform licence and hardware support — [Utsubo 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)

**ProRes**
- "Browsers have no support for Apple ProRes in their WebCodecs implementations."
- `@mediabunny/prores` adds a WASM ProRes decoder (TurboRes).
- Shared-memory multithreading needs COOP `same-origin` plus COEP `require-corp` or `credentialless`, and "credentialless isn't supported in Safari". Without isolation it falls back to a slower path.
- [Mediabunny: ProRes extension](https://mediabunny.dev/guide/extensions/prores)

**HAP**
- HAP variants:
  - Hap = DXT1.
  - Hap Alpha = DXT5.
  - Hap Q = YCoCg-DXT5.
  - Hap Q Alpha = YCoCg-DXT5 + RGTC1, which needs two textures and a decode shader.
  - Hap R = BC7.
  - Hap HDR = BC6H.
  - [Bluecadet Unity HAP: formats](https://unity.bluecadet.com/hap/formats/)
- HAP's value is that "only the Snappy compression is decoded on the CPU while the GPU handles the DXT texture data". FFmpeg decodes both stages on the CPU, which removes most of the benefit — [OBS forum: HAP/HAPQ GPU decoding](https://obsproject.com/forum/threads/support-for-hap-hapq-gpu-decoding.183936/)
- The reference implementation Vidvox/hap ("A codec for fast video playback", BSD) was last pushed 2024-07-25 — [GitHub Vidvox/hap](https://github.com/Vidvox/hap)
- **GitHub repository searches on 2026-10-15** for "hap webgl", "hap player javascript", "hap codec wasm", "hap decoder javascript" and "hap webgpu" returned **no browser HAP player or decoder** — [GitHub search API](https://api.github.com/search/repositories?q=hap+webgl)
- WebGPU `texture-compression-bc` support, crowd-sourced (no data date given):
  - Overall 86.96%.
  - **Windows 99.99%, macOS 87.34%, Linux 82.02%, ChromeOS 81.94%, iOS 54.91%, Android 35.1%**.
  - [web3dsurvey: texture-compression-bc](https://web3dsurvey.com/webgpu/features/texture-compression-bc)
- On Apple devices WebKit reports `texture-compression-bc` "only when the MTLDevice says it is supported": all Apple9 GPUs, and some Apple7/8 iPad GPUs (WebKit bug, July 2025) — [WebKit bug 295566](https://bugs.webkit.org/show_bug.cgi?id=295566)
- WebGL `WEBGL_compressed_texture_s3tc` is in Chrome 26, Edge 12, Firefox 22 and Safari 8, but **not Chrome Android** — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)

**Hardware decoder limits and memory**
- Chromium's VA-API decoder has "a maximum number of concurrent decoders … currently 16". It was lowered to 10 for AMD Stoney Ridge Chromebooks. When the cap is hit, decoder creation fails — [Chromium commit c74bb01](https://chromium.googlesource.com/chromium/src/+/c74bb01a2889afdfdd1e06f0144fb7b02e2e00a2)
- No documented WebCodecs-level instance cap was found for Windows, macOS or Safari (see Gaps).

**Recording output**
- `MediaRecorder` is in Chrome 47, Firefox 25, Safari 14.1. `HTMLCanvasElement.captureStream()` is in Chrome 51, Firefox 43, Safari 11 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Chrome's MediaRecorder "now supports both MP4 and Matroska muxer types with different HEVC and H.264 mime type specifications". HEVC is available only where the OS and device provide it — [blink-dev H26x MediaRecorder](https://groups.google.com/a/chromium.org/g/blink-dev/c/YJ1QijNiHeM/m/3EhMjMVwAgAJ)
- Safari 26 adds ALAC and PCM in MediaRecorder — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

### Inferences
- **Two playback engines are needed for a VJ tool:**
  - (a) `<video>` + `requestVideoFrameCallback` + `importExternalTexture` for simple looping clips. It is cheap and hardware-decoded, but seeking and sync are coarse.
  - (b) WebCodecs + a demuxer in a worker for frame-accurate, clock-locked playback: BPM-synced scrubbing, multi-layer sync, reverse playback via GOP caching. For (b), the app owns the clock: it decodes ahead into a small ring of `VideoFrame`s and closes them aggressively, which keeps GPU memory and decoder slots under control.
- **Asset strategy:** recommend H.264 (or HEVC on Mac/Windows Chrome) with **short GOPs or all-intra** for clips that need scrubbing. Offer ProRes via WASM only for import/transcode, not for live multi-layer playback (CPU cost). HAP support would be a differentiator. The plan:
  - Parse the MOV atoms (Mediabunny or mp4box.js can extract samples).
  - Snappy-decompress in WASM.
  - Upload BC1/BC3 (and BC7 for Hap R) blocks with `writeTexture` to a `texture-compression-bc` texture.
  - Run a YCoCg→RGB shader for Hap Q.
  - On iOS and Android this will often be unavailable (35–55% BC support), so it is a desktop-only feature.
  - The WebGPU spec's `texture-compression-bc` feature covers the BC1–BC7 formats — [WebGPU spec: texture-compression-bc](https://gpuweb.github.io/gpuweb/#texture-compression-bc)
- Decoder slots are finite and platform-dependent (16 on VA-API). The app should pool and reuse `VideoDecoder`s across layers and pause or close decoders for invisible layers.

### Gaps
- No documented hardware decoder session limits for Windows (D3D11/MediaFoundation), macOS (VideoToolbox) or Safari WebCodecs; this needs empirical testing.
- Safari's WebCodecs codec matrix (HEVC, AV1 only on hardware with AV1 decode, VP9) was not verified from a primary source in this session.
- No source confirms whether Safari's `<video>` plays ProRes `.mov` on macOS.
- No JS/WASM Snappy library was verified in this session.
- No engineering blog from Descript, CapCut, Clipchamp or Figma was retrieved, because the search budget ran out.

## 3. Multi-display output: Window Management, fullscreen per screen, Presentation API, popups, shared rendering, vsync, Wake Lock

### Takeaway
Only Chromium (Chrome/Edge 100+) can enumerate screens (`getScreenDetails`), place windows on a specific screen and go fullscreen on a chosen screen (`requestFullscreen({screen})`). Firefox and Safari cannot, so a browser-only multi-projector output is in practice **Chromium-only**. Fullscreen on several displays from one gesture needs Chrome's "Automatic Fullscreen" content setting, which only enterprise policy or Isolated Web Apps can grant. A desktop wrapper (Electron/Tauri) removes all of these restrictions.

### Cited Findings
- `Window.getScreenDetails()`: Chrome/Edge 100; **Firefox: no; Safari: no**. `ScreenDetailed`: Chrome/Edge 100. `Screen.isExtended`: Chrome/Edge 100 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json); MDN: [Window.getScreenDetails](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails)
- `Element.requestFullscreen()` with the `screen` option: Chrome/Edge 100 only — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- web.dev's multi-screen guide shows the pattern:
  - Call `getScreenDetails()`, listen for `screenschange`, then `window.open(url, '', 'left=…,top=…,width=…,height=…')` using a screen's `availLeft`/`availTop`.
  - "There's no classic way to control multi-screen layouts" without the API.
  - [web.dev: How to use multiple screens](https://web.dev/articles/web-apps/multiple-screens)
- The spec pattern: "first requesting fullscreen on a specific screen … and then opening a popup window on another screen … in a single event listener" — [W3C Multi-Screen Window Placement WD](https://www.w3.org/TR/2023/WD-window-management-20230330/)
- Automatic Fullscreen content setting (Intent to Ship):
  - It "permits Element.requestFullscreen() without a user gesture".
  - Combined with the Window Management permission and unblocked popups, it enables "Opening a fullscreen popup on another display from one gesture" and "Showing fullscreen content on multiple displays from one gesture".
  - Blocked by default, and sites cannot prompt for it. It is granted via Isolated Web Apps or the enterprise policy `AutomaticFullscreenAllowedForUrls`.
  - Desktop only; "Gecko and WebKit have not given signals".
  - [blink-dev: Intent to Ship Automatic Fullscreen](https://groups.google.com/a/chromium.org/g/blink-dev/c/WOch5LPq9RY)
  - Milestone conflict: the Intent to Ship says it ships in 126, while a Fugu update lists M127 — [Fugu: New in Chrome 127](https://groups.google.com/a/chromium.org/g/fugu-dev/c/iMhwu71SSzA/m/-dpJjnF9AwAJ)
- Presentation API (`Presentation`, `PresentationRequest`): Chrome 47, Edge 79, Chrome Android 47; **not Firefox or Safari** — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Document Picture-in-Picture: Chrome/Edge 116, **Firefox 151**, not Safari, not Android — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Building blocks for cross-window rendering and communication:
  - `BroadcastChannel`: Chrome 54, Firefox 38, Safari 15.4.
  - `SharedArrayBuffer`: Chrome 68, Firefox 79, Safari 15.2.
  - `crossOriginIsolated`: Chrome 87, Firefox 72, Safari 15.2.
  - COOP header: Chrome 83, Firefox 79, Safari 15.2.
  - **COEP `credentialless`: Chrome 96, Firefox 119, not Safari**.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Safari 27 cross-origin isolation changes:
  - `structuredClone()`/`postMessage()` now throw `DataCloneError` for a `SharedArrayBuffer` outside cross-origin-isolated contexts.
  - Cross-origin isolation is enforced better for workers.
  - Sub-millisecond `requestAnimationFrame` timestamps are now provided in isolated contexts.
  - [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Frame pacing and throttling:
  - "The frequency of calls to the callback function will generally match the display refresh rate".
  - "`requestAnimationFrame()` calls are paused in most browsers when running in background tabs or hidden `<iframe>`s".
  - [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- Chromium on Windows throttles the frame rate of **occluded** windows ("When the window is occluded the frame rate is throttled") — [Chromium commit: kApplyNativeOcclusionToCompositor](https://chromium.googlesource.com/chromium/src/+/55bef1db2cd4e5da5ef1636ff3025f1180f61399)
- Chrome stops calling rAF for background pages. Pages playing audible audio are exempt from background *timer* throttling — [Chrome: Background tabs](https://developer.chrome.com/blog/background_tabs?hl=en)
- Genlock:
  - "Safari 27.0 adds support for synchronized video playback on macOS displays using genlock" — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
  - Apple's genlock setup lists Mac mini (M5 Pro) and Mac Studio (M5 Max/M5 Ultra) on macOS 27 with a genlock-capable USB-C dock such as the Blackmagic Camera ProDock — [Apple Support 148292](https://support.apple.com/en-gb/148292)
- Screen Wake Lock: Chrome 84, Firefox 126, Safari 16.4. iOS Safari works in Home Screen web apps only from 18.4 ("Does not work in standalone Home Screen Web Apps" before) — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Desktop wrappers:
  - Electron's `screen.getAllDisplays()` returns `Display[]`, and it emits `display-added`/`display-removed` — [Electron: screen](https://www.electronjs.org/docs/latest/api/screen)
  - Tauri v2 exposes `availableMonitors()`, `currentMonitor()`, `primaryMonitor()` and `Window.setFullscreen`/`setPosition`. Creating windows from JS needs the `core:window:allow-create` permission — [Tauri v2 window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)

### Inferences
- **Recommended pure-web output design (Chromium):**
  - The control window opens one same-origin popup per projector after `getScreenDetails()` and fullscreens each one with `requestFullscreen({screen})`. One click per output is acceptable; one click for all outputs needs the Automatic Fullscreen policy or an IWA.
  - Each output window either renders its own slice with its own GPU context (state synced via BroadcastChannel or SharedArrayBuffer), or receives frames.
  - Sharing a single `GPUDevice` across same-origin windows is plausible in Chromium but unverified (see Gaps). The robust default is "replicate the scene state, render locally in each output window".
  - Avoid `canvas.captureStream()` → `<video>` piping: it adds latency and re-encode/copy overhead (inference).
- Output windows must stay visible and unoccluded. Background or occluded windows lose rAF. A fullscreen popup on a separate display is visible, so it should not be throttled, but control-window-only rendering would be.
- Cross-origin isolation (needed for SharedArrayBuffer, WASM threads and the ProRes decoder) requires COOP/COEP headers on the PWA host, and every embedded cross-origin asset needs CORP/CORS. Safari lacks `credentialless`, so `require-corp` is the portable choice.
- **Firefox and Safari can only produce a single fullscreen output.** The user would have to drag windows manually, and fullscreen goes to whichever screen the window is on. This alone is a strong argument for a desktop wrapper for multi-projector shows.

### Gaps
- No primary source confirms whether a `GPUDevice` or WebGL context created in one window can render to a canvas in a same-origin popup (cross-realm canvas). This needs a prototype test.
- How Chromium handles vsync across multiple monitors with different refresh rates (one compositor clock vs per-display BeginFrame), and tearing behaviour on secondary displays, was not researched (search budget exhausted).
- The current behaviour of the experimental `window.open()` "fullscreen" feature was not confirmed.

## 4. Control I/O: Web MIDI, WebHID, Web Serial, Gamepad, OSC/Art-Net/sACN bridges, Ableton Link, MIDI clock

### Takeaway
Web MIDI works in Chromium (with a permission prompt since Chrome 124) and Firefox (gated by an auto-generated "site permission add-on"), but **never in Safari**. WebHID is Chromium-only. Web Serial is Chromium plus, newly, Firefox 151. Gamepad is universal. Browsers cannot open raw UDP sockets, so OSC, Art-Net, sACN and Ableton Link need a bridge: a local Node/Rust companion, a desktop wrapper, or Chrome's Direct Sockets, which exists only in Isolated Web Apps.

### Cited Findings
- Web MIDI (`MIDIAccess`, `navigator.requestMIDIAccess`):
  - Chrome 43, Edge 79, Firefox 108, Chrome Android 43; **Safari / iOS Safari: not supported**.
  - Firefox note: "API access is gated by installation of a site permission add-on (user prompt), secure context".
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Chrome made Web MIDI always require permission "starting in Chrome 124" — [Chrome blog: Web MIDI permission prompt](https://developer.chrome.com/blog/web-midi-permission-prompt)
- WebKit's Web MIDI bug is still open. Its last comment (Nov 2024) is a user request — [WebKit bug 107250](https://bugs.webkit.org/show_bug.cgi?id=107250). The Safari 26.0 and 27.0 feature posts contain no Web MIDI entry — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- Device APIs (2026-10-15):
  - WebHID: Chrome/Edge 89 only.
  - Web Serial: Chrome/Edge 89, **Firefox 151**; Chrome Android 148 (Bluetooth RFCOMM-only before that, from 138).
  - WebUSB: Chrome 61 / Edge 79.
  - Gamepad `getGamepads()`: Chrome 35, Firefox 29, Safari 10.1.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Direct Sockets (TCP/UDP from a web app):
  - "Feature is available only in Isolated Web Apps on desktop platforms". Shipping on desktop in Chrome 130.
  - At intent time (Aug 2024) end users could only use it on ChromeOS, "the only platform that currently supports Isolated Web Apps".
  - Mozilla's position was "Harmful".
  - [blink-dev: Intent to Ship Direct Sockets](https://groups.google.com/a/chromium.org/g/blink-dev/c/5R0P_aYBWQI)
  - A proposal adds multicast for IWAs (relevant to sACN multicast) — [explainers-by-googlers/multicast-in-direct-sockets](https://github.com/explainers-by-googlers/multicast-in-direct-sockets)
- WebTransport: Chrome 97, Firefox 114, **Safari 26.4** — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json). It needs an HTTP/3 server, and UDP-blocking networks need a WebSocket fallback — [Utsubo 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)
- OSC bridges:
  - The `osc-js` package has a `BridgePlugin`: a Node process relays between UDP and WebSocket clients (default WebSocket `ws://localhost:8080`) — [npm osc-js](https://npmjs.com/package/osc-js)
  - `osc.js` (colinbdclark) has UDP ports in Node and WebSocket ports in the browser. Its last release was 2.4.5 (2024-08-20) — [GitHub colinbdclark/osc.js](https://github.com/colinbdclark/osc.js)
  - `node-osc` v11.7.1 (2026-09-14) is actively maintained — [GitHub MylesBorins/node-osc](https://github.com/MylesBorins/node-osc)
- Art-Net/sACN: browsers cannot send raw UDP. Hardware nodes (e.g. Chauvet DMX-AN2, Botex NETcon) convert Art-Net/sACN→DMX512 and are configured via web UIs. The open-source ESP32 "LumiGate" uses WebSocket only for its diagnostic UI — [ControlBooth: LumiGate](https://www.controlbooth.com/goto/post?id=454998)
- Ableton Link:
  - The official Link library's latest release is **Link-4.1** (2026-09-23) — [GitHub Ableton/link](https://github.com/Ableton/link)
  - Carabiner embeds Link and "listens for local TCP connections" on port 17000. It sends session updates "no more often than every twenty milliseconds". The maintainers note it "does not support the full power and elegance of Link" — [GitHub Deep-Symmetry/carabiner](https://github.com/Deep-Symmetry/carabiner)
  - The Node binding `node-abletonlink` was last pushed 2023-06-15 — [GitHub 2bbb/node-abletonlink](https://github.com/2bbb/node-abletonlink)

### Inferences
- **Recommended I/O architecture:** a small **local companion process** (Node or Rust; in Electron/Tauri it is the main process). It owns:
  - UDP OSC in/out (node-osc).
  - Art-Net/sACN out (UDP and multicast).
  - Ableton Link (native library, or Carabiner over TCP).
  - Optionally MIDI for Safari users.
- The companion exposes all of this to the UI over a localhost WebSocket (or WebTransport). The same protocol then works for PWA + companion, for Electron/Tauri IPC, and for remote phone controllers.
- MIDI clock (0xF8) and MTC quarter-frame messages arrive as ordinary `MIDIMessageEvent`s with high-resolution timestamps in Chromium/Firefox. Tempo has to be derived by smoothing inter-clock intervals in JS (inference; not verified against the spec in this session).
- Safari users (and Tauri on macOS, which uses WKWebView) get no Web MIDI. The companion/bridge or a native plugin has to provide MIDI there.

### Gaps
- Open Stage Control: the GitHub API returned an archived repo with only 7 stars at `jean-emmanuel/open-stage-control` (v1.31.0, 2026-09-23). Its canonical location and packaging (believed to be Electron) could not be verified.
- Whether Isolated Web Apps (and therefore Direct Sockets) can be installed by ordinary users on Windows or macOS as of 2026 was not confirmed.
- No browser-native Ableton Link implementation exists; none was found.

## 5. Audio: Web Audio analysis, AudioWorklet, BPM/beat detection, input latency, interface selection

### Takeaway
FFT band analysis (`AnalyserNode`) and custom DSP (`AudioWorklet`) work in all engines. Live BPM detection is available via `realtime-bpm-analyzer` (AudioWorklet-based). Essentia.js's best tempo algorithm is offline-only. Input device selection works via `getUserMedia({audio:{deviceId}})`. For music input, echo cancellation, noise suppression and AGC should be disabled. Output device routing is uneven: `AudioContext.setSinkId` exists only in Chromium.

### Cited Findings
- `AudioWorklet`: Chrome 66, Edge 79, Firefox 76, Safari 14.1 (iOS 14.5) — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- `AudioContext` options and output routing:
  - `latencyHint` option: Chrome 58, Safari 14.1, **not Firefox**.
  - `outputLatency`: Chrome 102, Firefox 70, Safari 18.4.
  - `AudioContext.setSinkId`: **Chrome/Edge 110 only**.
  - `HTMLMediaElement.setSinkId`: Chrome 49, Firefox 116, Safari 18.4.
  - `MediaDevices.selectAudioOutput`: Firefox 116 only.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Autoplay and Web Audio: "If an `AudioContext` is created before a user gesture, it starts in the 'suspended' state". `resume()` must be called after a gesture (Chrome 71+) — [Chrome: Autoplay policy](https://developer.chrome.com/blog/autoplay)
- getUserMedia audio constraints:
  - `echoCancellation`, `autoGainControl` and `noiseSuppression` are standard constraints, and `getCapabilities()` shows whether each can be turned off — [MDN: MediaStreamTrack.getCapabilities](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities); [addpipe: getUserMedia audio constraints](https://blog.addpipe.com/audio-constraints-getusermedia/)
  - A Safari 26 macOS report says `echoCancellation:false` produces stereo even when `channelCount:1` is set — [Apple Developer Forums 804765](https://developer.apple.com/forums/thread/804765)
- `realtime-bpm-analyzer`:
  - "analyze the BPM … of an audio/video node or any stream in realtime", "Zero dependencies — Uses native Web Audio API", with microphone/stream/file sources.
  - Latest release v5.0.15 (2026-06-18); repo last pushed 2026-10-15.
  - [GitHub dlepaux/realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer)
  - A depscope listing calls it "AudioWorklet-native". Licence listings conflict (MIT on Yarn vs Apache-2.0 on depscope) — [depscope](https://depscope.dev/pkg/npm/realtime-bpm-analyzer); [Yarn](https://classic.yarnpkg.com/en/package/realtime-bpm-analyzer)
- Essentia.js:
  - WASM build of Essentia, "for both offline and real-time audio feature extraction" — [Essentia.js](https://essentia.upf.edu/essentiajs)
  - "RhythmExtractor2013 … relies on statistics gathered over the whole music track, and therefore it is not suited for real-time detection" — [Essentia beat detection tutorial](https://essentia.upf.edu/tutorial_rhythm_beatdetection.html)
  - Repo last pushed 2025-12-10 — [GitHub MTG/essentia.js](https://github.com/MTG/essentia.js)
- Safari 27 fixed `HTMLMediaElement.volume` having no effect when the element was routed through an `AudioContext`, and fixed decoding of WebM audio with more than two channels — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

### Inferences
- **Audio-reactive pipeline:** getUserMedia (device chosen via `enumerateDevices`, with EC/NS/AGC off) → `MediaStreamAudioSourceNode` → `AnalyserNode` for per-frame FFT bands (low/mid/high, smoothed), plus an `AudioWorklet` for onset/beat detection.
- For BPM, use `realtime-bpm-analyzer`, or a custom spectral-flux onset detector plus tempo tracking in the worklet. Ableton Link or MIDI clock (via the bridge) should override audio BPM when present, since they are more reliable for live shows.
- Run audio analysis in the control window. Hidden or background tabs throttle rAF, but the AudioWorklet keeps running. Push analysis results to output windows via BroadcastChannel or SharedArrayBuffer.

### Gaps
- aubio compiled to WASM (aubiojs) was not researched because the search budget ran out.
- No measured getUserMedia input-latency figures per browser or OS (e.g. CoreAudio vs WASAPI) were found. These must be measured.
- Multi-channel audio interface input (>2 channels) behaviour per browser was not verified.

## 6. Live inputs & interop: cameras/capture cards, screen capture, NDI, Syphon/Spout, WebRTC/WebTransport

### Takeaway
Cameras and UVC capture cards work via `getUserMedia`, and screen and window capture via `getDisplayMedia` (now also on iOS Safari 27). **NDI, Syphon and Spout have no browser support.** The pure-web workarounds are virtual webcams (NDI Webcam Input / NDI Virtual Input, which show up as cameras) and WebRTC gateways (NDI→WHEP). Proper GPU-level interop needs a desktop wrapper with native addons. Electron now has an experimental `sharedTexture` API and offscreen shared-texture rendering, and community addons already bridge Spout and Syphon Metal in both directions.

### Cited Findings
- Capture APIs:
  - `getUserMedia`: Chrome 53, Firefox 36, Safari 11.
  - `getDisplayMedia`: Chrome 72, Firefox 66, Safari 13, **iOS Safari 27**, not Chrome Android.
  - `CaptureController`: Chrome 109 only.
  - `MediaStreamTrackProcessor`: Chrome 94 (exposed on Window, not worker = partial), Safari 18, not Firefox.
  - `VideoTrackGenerator`: Safari 18 only.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Safari 27 fixed `getDisplayMedia()` starting at very low quality — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- NDI as a webcam:
  - NDI Webcam Input exposes an NDI source as a webcam ("NewTek NDI Video"). It supports up to 1080p and 4K UHD at 60 fps, plus a "NewTek NDI Audio" virtual audio device — [StreamGeeks: NDI Webcam Input](https://streamgeeks.us/?p=8830)
  - On macOS, NDI Virtual Input docs say "As of the 6.1 update we are experiencing issues with Virtual input" (a hotfix is listed) — [NDI docs: Virtual Input (Mac)](https://docs.ndi.video/all/using-ndi/ndi-tools/ndi-tools-for-mac/virtual-input)
  - vMix documents its virtual camera/audio as usable "in other programs and web browsers" — [vMix KB 235](https://1.vmix.com/knowledgebase/article.aspx/235/how-to-send-a-virtual-camera-output-to-third-party-apps-and-web-browsers)
- NDI ↔ WebRTC gateways:
  - Softvelum Nimble Streamer ingests NDI and outputs WHEP (WebRTC playback) "with sub-second latency" (2025-07) — [Softvelum: NDI → WHEP](https://softvelum.com/2025/07/ndi-whep-webrtc-workflow/)
  - Meetecho's Janus NDI plugin goes the other way, WebRTC → NDI — [GitHub meetecho/janus-ndi](https://github.com/meetecho/janus-ndi)
  - Softvelum also supports OMT (Open Media Transport), "a open source alternative to NDI" — [Softvelum NDI category](https://softvelum.com/category/ndi)
- NDI in Node/Electron:
  - `grandiose` (Node NDI bindings) was last pushed 2023-08-22 — [GitHub Streampunk/grandiose](https://github.com/Streampunk/grandiose)
  - modV (an Electron audio-visualisation app) uses a fork of grandiose for NDI sources — [GitHub vcync/modV](https://github.com/vcync/modV)
  - DistroAV (OBS NDI plugin) 6.2.2 was released 2026-10-14 — [GitHub DistroAV/DistroAV](https://github.com/DistroAV/DistroAV)
- Syphon/Spout facts: "shared-memory methods that work only on the same machine". Spout needs NVIDIA/AMD ("Intel does not work"). Syphon is limited to 8-bit RGBA, while Spout supports up to 32-bit float RGBA — [Derivative: Syphon Spout Out TOP](https://derivative.ca/UserGuide/Syphon_Spout_Out_TOP)
- Electron offscreen rendering:
  - With `webPreferences.offscreen.useSharedTexture`, frames go "directly into GPU textures". It is "an advanced feature requiring a native node module".
  - CPU-bitmap mode caps at 240 fps.
  - [Electron: Offscreen Rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
- Electron `sharedTexture` API (experimental):
  - It can "Import shared textures into Electron and converts platform specific handles into VideoFrame".
  - Main-process `importSharedTexture`/`sendSharedTexture` pair with a renderer-side `setSharedTextureReceiver`, with a 1000 ms timeout.
  - [Electron: sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)
- `electron-texture-bridge`:
  - A napi-rs addon for "Bidirectional GPU texture sharing between Electron and VJ software via Spout / Syphon Metal". It sends from OSR `useSharedTexture` and receives from external Syphon/Spout servers.
  - Lists Resolume Arena, VDMX, OBS and TouchDesigner as peers.
  - v0.15.0 (2026-08-14), 11 stars — [GitHub naporin0624/electron-texture-bridge](https://github.com/naporin0624/electron-texture-bridge)
- `node-syphon`:
  - Publishes and subscribes Syphon (OpenGL and Metal) as pixel buffers.
  - In Electron it publishes IOSurface handles. Subscribing via handles is "waiting for the approval of this Electron PR" (#46811).
  - Last pushed 2026-10-11 — [GitHub benoitlahoz/node-syphon](https://github.com/benoitlahoz/node-syphon)
- `electron-spout` ("Share Electron's Offscreen to Spout") was last pushed 2024-07-07 — [GitHub reitowo/electron-spout](https://github.com/reitowo/electron-spout)
- WebRTC: Safari 27 adds the `targetLatency` receiver attribute — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

### Inferences
- **PWA tier:**
  - Camera and capture-card input via getUserMedia.
  - Window/screen capture via getDisplayMedia.
  - NDI via virtual webcam (user installs NDI Tools).
  - Remote phone controllers and remote preview via WebRTC (DataChannel for control, video for previews) or WebSocket.
- **Desktop tier (Electron):**
  - Syphon/Spout in and out: native addon → shared texture → `VideoFrame` → `importExternalTexture`. That is zero-copy into the WebGPU compositor.
  - NDI via a native NDI SDK addon. Note that Node NDI bindings are poorly maintained, so expect to write your own napi-rs/N-API wrapper.
  - The Tauri equivalent would need a custom Rust plugin plus a frame transport into the webview. There is no zero-copy texture import into WKWebView or WebView2 (inference; no such API was found).

### Gaps
- SpoutCam (Spout → virtual webcam) and Syphon virtual-camera options were not verified.
- No NDI-in-browser solution newer than gateways was found. NDI 6.x WebRTC features (if any) were not verified.
- The Electron version that introduced `sharedTexture` was not stated in its docs.

## 7. Storage: File System Access, persisted permissions, OPFS, quotas, persist(), File Handling

### Takeaway
Only Chromium can reference a user's large media folders **in place** (`showDirectoryPicker` with persistent permissions since Chrome 122, and folder watching via `FileSystemObserver` from Chrome 133). Firefox and Safari can only use OPFS, which is origin-private and copied in, or `<input type=file>`. Quotas are generous (around 60% of disk in Chrome and Safari; 10 GiB best-effort in Firefox, rising to 50% of disk if persisted). The File Handling API ("open with…") is Chromium-only.

### Cited Findings
- File pickers and watching:
  - `showDirectoryPicker` / `showOpenFilePicker`: Chrome/Edge 86, Chrome Android 132; **not Firefox or Safari**.
  - `FileSystemHandle.queryPermission`/`requestPermission`: Chrome 86.
  - `FileSystemObserver`: Chrome/Edge 133 only (non-standard-track).
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Persistent permissions (from Chrome 122):
  - A three-way prompt includes "Allow on every visit". It appears when a handle stored in IndexedDB is re-requested on a later visit.
  - **Installed apps don't see the prompt — permissions persist by default once granted.**
  - [Chrome: Persistent permissions for the File System Access API](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
- OPFS and storage APIs:
  - `StorageManager.getDirectory()` (OPFS): Chrome 86, Firefox 111, Safari 15.2.
  - `FileSystemSyncAccessHandle`: Chrome 102, Firefox 111, Safari 15.2.
  - `StorageManager.persist()`: Chrome 55, Firefox 57, Safari 15.2.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Safari 26 added "File System WritableStream API, enabling direct writing to files" — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Safari 27 fixed `FileSystemDirectoryHandle.resolve()` and `removeEntry()` — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- File Handling API (manifest `file_handlers`) and `LaunchQueue`: Chrome/Edge 102 only — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Quotas:
  - Chromium: an origin can store "up to 60% of the total disk size in both persistent and best-effort modes".
  - Firefox: best-effort is min(10% of disk, 10 GiB group limit); persisted origins get "50% of the total disk size, capped at 8 TiB".
  - Safari browser: about 60% per origin; WKWebView-embedding apps get "around 15%" per origin (20% overall).
  - Safari deletes script-written data after "seven days of browser use" without interaction when tracking prevention is on.
  - OPFS counts toward the quota (`QuotaExceededError`).
  - `persist()` prompts in Firefox and is auto-decided in Chromium/Safari.
  - [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Inferences
- **Media library design:**
  - In Chromium, store `FileSystemDirectoryHandle`s in IndexedDB, re-request permission on launch (silent for installed PWAs), and stream files directly into the demuxer or `<video>` via `getFile()` / object URLs, without copying.
  - Keep OPFS for app-generated caches: thumbnails, waveform and analysis data, transcoded HAP/intra proxies, GOP indexes.
  - Call `persist()` on first project save.
  - In Safari/Firefox, fall back to importing into OPFS, which duplicates the data. Warn about disk usage and Safari's 7-day eviction (mitigated by `persist()` and installation, though Home Screen exemption is not documented).
- Note the Tauri/WKWebView quota of about 15% per origin. A desktop wrapper should use native file access anyway and never copy media into web storage.

### Gaps
- Whether Safari Home Screen / Dock web apps are exempt from the 7-day eviction is "not documented" on MDN.
- No sources were gathered on IndexedDB performance with very large blob stores.

## 8. Desktop packaging: PWA vs Electron vs Tauri v2 (and v3 CEF), native capabilities, size, updates, signing, tool landscape

### Takeaway
For this tool, **Electron is the lowest-risk desktop wrapper as of October 2026**:
- It bundles Chromium 152 (Electron 44.7.2), so behaviour is identical everywhere: WebGPU, WebCodecs with HEVC on macOS/Windows, Web MIDI, and the window-placement APIs.
- Its main process provides UDP sockets, multi-display windows and native addons.
- It is the only wrapper with documented GPU shared-texture plumbing and working community Spout/Syphon bridges.

Tauri v2 is much smaller, but it uses the system webview. On macOS that is WKWebView (Safari engine), which means **no Web MIDI**, Safari's WebGPU/WebCodecs, and no zero-copy texture path. On Linux it is WebKitGTK. Tauri's v3 alpha line adds a **CEF (Chromium) runtime**, which could remove the engine disparity once stable. A PWA stays useful as a zero-install tier (Chromium-first) and as the remote/phone controller.

### Cited Findings
- Electron:
  - Latest stable **v44.7.2 (2026-10-13), Chromium 152.0.7977.149, Node 24.21.0** — [Electron releases.json](https://releases.electronjs.org/releases.json); [GitHub electron/electron](https://github.com/electron/electron)
  - Offscreen rendering with `useSharedTexture` and the experimental `sharedTexture` API — see section 6 — [Electron OSR](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering), [Electron sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)
- Tauri:
  - Latest stable **v2.12.4 (2026-10-14)**. A **v3.0.0-alpha.5** was published the same day — [GitHub tauri-apps/tauri releases](https://github.com/tauri-apps/tauri/releases)
  - The v3 alpha notes describe a `tauri-runtime-cef` crate beside `tauri-runtime-wry`. Bundler alpha notes add a CEF webview runtime option, shipped in the bundle or loaded from a shared runtime — [newreleases: tauri-v3.0.0-alpha.0](https://newreleases.io/project/github/tauri-apps/tauri/release/tauri-v3.0.0-alpha.0); [newreleases: tauri-bundler-v3.0.0-alpha.0](https://newreleases.io/project/github/tauri-apps/tauri/release/tauri-bundler-v3.0.0-alpha.0)
  - Tauri's Rust CEF bindings live in `cef-rs` — [docsearch: tauri-apps/cef-rs](https://docsearch.algolia.com/mcp/docs/repo/tauri-apps/cef-rs)
  - Webviews: Windows uses WebView2 (Chromium, self-updating, preinstalled on Windows 11); macOS/iOS use WKWebView, "updated only through regular OS updates"; Linux uses WebKitGTK (distro-dependent). All are "system-provided rather than bundled" — [Tauri: Webview versions](https://v2.tauri.app/reference/webview-versions/)
  - Updater: "Tauri's updater needs a signature to verify that the update is from a trusted source. This cannot be disabled". Keys come from `tauri signer generate`, and static JSON or dynamic endpoints are supported — [Tauri v2 updater](https://v2.tauri.app/plugin/updater/)
  - Security: capabilities scope native permissions per window label — [Tauri v2 capabilities](https://v2.tauri.app/security/capabilities/)
- Consequences of Safari/WKWebView for Tauri on macOS:
  - No Web MIDI, WebHID, Web Serial, Window Management, FSA pickers or Document PiP in Safari ([BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)).
  - WebGPU and WebCodecs are present only from Safari 26 / 16.4 respectively ([BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)).
  - WKWebView-embedding apps get about 15% of disk per origin ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
- Size and memory: blog benchmarks put Tauri at about 2–10 MB vs Electron 80–200 MB. One 2026 test reports a "Hello World" at 3.2 MB vs 85 MB, and idle RAM of 42 MB vs 168 MB. Methodologies are not published, so treat these as indicative only — [tech-insider: Tauri vs Electron 2026](https://tech-insider.org/tauri-vs-electron-2026/); [pkgpulse: Electron vs Tauri 2026](https://www.pkgpulse.com/guides/electron-vs-tauri-2026)
- Existing creative and VJ tools and their stacks:
  - **cables.gl Standalone** is "an electron build of the cables editor". Its docs list "running installations or VJ sets without internet access" as a use case — [cables docs: What is Cables Standalone](https://cables.gl/docs/6_2_standalone/0_general/general). The standalone repo's latest release is v0.12.0 (2026-10-14) — [GitHub cables-gl/cables_electron](https://github.com/cables-gl/cables_electron)
  - **modV** ("modular audio visualisation environment built upon web technologies") builds with `electron:build` and uses NDI via grandiose — [GitHub vcync/modV](https://github.com/vcync/modV)
  - **Hydra** ("Livecoding networked visuals in the browser", 2.7k stars) is browser-native — [GitHub hydra-synth/hydra](https://github.com/hydra-synth/hydra)
  - `electron-texture-bridge` targets Resolume Arena, VDMX, OBS and TouchDesigner (native tools) as Spout/Syphon peers — [GitHub naporin0624/electron-texture-bridge](https://github.com/naporin0624/electron-texture-bridge)
- Isolated Web Apps are the only web container that unlocks Direct Sockets and user-grantable Automatic Fullscreen. At intent time, end users could install IWAs only on ChromeOS — [blink-dev Direct Sockets I2S](https://groups.google.com/a/chromium.org/g/blink-dev/c/5R0P_aYBWQI); [blink-dev Automatic Fullscreen I2S](https://groups.google.com/a/chromium.org/g/blink-dev/c/WOch5LPq9RY)

### Inferences
**Capability matrix for this tool:**

| Need | PWA (Chromium) | PWA (Safari/Firefox) | Electron 44 | Tauri v2 (mac=WKWebView, win=WebView2) |
|---|---|---|---|---|
| WebGPU compositor | yes (Linux partial) | Safari 26+ yes; Firefox Win/Apple-silicon only | yes (Chromium 152) | mac: Safari 26+ engine; win: WebView2 Chromium |
| Multi-projector fullscreen per screen | yes (one gesture per output, or enterprise policy) | **no** | yes (native windows) | yes (native windows) |
| Web MIDI | yes | Firefox yes (add-on gate); **Safari no** | yes | win yes (WebView2, untested); **mac no** |
| OSC / Art-Net / Link (UDP) | needs companion | needs companion | main process | Rust core |
| Syphon / Spout / NDI | virtual-webcam workaround only | same | native addons, zero-copy via sharedTexture | custom Rust plugin, frame copy into webview |
| Media library in place | FSA + persistent permission | OPFS copy only | native fs | native fs |
| Install size | 0 | 0 | ~80–200 MB | ~3–10 MB |

- **Recommended path:**
  - Keep the React/Vite PWA as the single codebase.
  - Abstract platform services (outputs/windows, MIDI, OSC/DMX/Link, file library, texture I/O) behind a TypeScript "host" interface.
  - Ship (1) a Chromium-first PWA tier and (2) an Electron "pro" build for shows.
  - Re-evaluate Tauri once its CEF runtime is stable. That would combine Tauri's Rust core with a bundled Chromium, at the cost of most of its size advantage.

### Gaps
- Electron's auto-update and code-signing docs were not fetched. Squirrel/electron-updater specifics, macOS notarization and Windows signing cost/requirements are unverified here.
- WebView2's support for Web MIDI, WebHID and permission prompts inside Tauri hosts was not verified.
- Open Stage Control's packaging (believed to be Electron) could not be verified (see section 4).
- No Tauri-based VJ or projection-mapping tool was found.

## 9. Concrete gotchas: autoplay, GPU/context loss, color & HDR, throttling, high-DPI, Safari-specific limits

### Takeaway
The main production risks:
- Autoplay and AudioContext gestures.
- GPU device loss, which needs full resource re-creation.
- Background and occluded windows losing rAF.
- Inconsistent colour management: wide gamut and HDR canvas are mostly Chromium-only on the WebGPU path.
- Safari's missing device and window APIs.

Each needs explicit handling in the architecture.

### Cited Findings
- **Autoplay** (Chrome policy):
  - "Muted autoplay is always allowed".
  - Autoplay with sound needs user interaction, a crossed Media Engagement Index threshold, or an installed PWA (desktop).
  - `play()` returns a Promise that must be checked.
  - AudioContext starts "suspended" before a gesture.
  - [Chrome: Autoplay policy](https://developer.chrome.com/blog/autoplay)
- **Device loss:**
  - `GPUDevice.lost` is in Chrome 113/144, Firefox 141 (platform-limited), Safari 26 — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
  - On device loss, "Any WebGPU resources created with a previous device (buffers, textures, etc.) will need to be re-created with the new one". An adapter may become permanently unavailable, so its new devices come back already lost. Causes include low GPU memory and driver faults — [LuciadRIA: WebGPU device loss](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/articles/howto/view/webgpu_device_loss.html); [MDN: GPUDevice.lost](https://developer.mozilla.org/docs/Web/API/GPUDevice/lost)
  - WebGL `webglcontextlost` / `isContextLost` are universal — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
  - Safari 27 fixed `onuncapturederror` not firing (WebGPU) and WebGL state not being reset on context loss — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- **Colour and HDR:**
  - 2D canvas `colorSpace` (display-p3): Chrome 92, Safari 15.2, **not Firefox**.
  - WebGL `drawingBufferColorSpace`: Chrome 104, Firefox 132, Safari 16.4.
  - WebGPU canvas `toneMapping` (HDR "extended"): **Chrome 129 only** (not Firefox/Safari per BCD).
  - `importExternalTexture` display-p3: Chrome only.
  - [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
  - Chrome 129's WebGPU canvas tone-mapping mode "allows WebGPU to draw colors brighter than white" using an `rgba16float` canvas format and `toneMapping: {mode: "extended"}` — [Chrome: New in WebGPU 129](https://developer.chrome.com/blog/new-in-webgpu-129)
  - Safari 26 adds CSS `dynamic-range-limit` and HDR images, including "images in WebGPU Canvas" — [WebKit Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
  - Safari 27 adds `srgb-linear` and `display-p3-linear` predefined colour spaces and fixes HDR video appearing washed out — [WebKit Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
  - Chrome's HDR video handling on Windows and macOS (PQ/HDR10/HLG), and its tone-mapping fixes when dragging windows between SDR and HDR monitors (Chrome 123) — [StaZhu HEVC guide](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding)
- **Throttling:** rAF pauses in background tabs and hidden iframes ([MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)), and Chromium on Windows throttles occluded windows ([Chromium commit](https://chromium.googlesource.com/chromium/src/+/55bef1db2cd4e5da5ef1636ff3025f1180f61399)). Use rAF's timestamp argument, "otherwise, the animation will run faster on high refresh-rate screens" ([MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
- **Safari-specific limits** (all per [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)):
  - No Web MIDI, WebHID, Web Serial, WebUSB.
  - No `getScreenDetails` or fullscreen-on-screen.
  - No Presentation API, no Document PiP.
  - No FSA pickers, no File Handling.
  - No COEP `credentialless`.
  - `ImageDecoder` only in preview.
  - `HTMLMediaElement.captureStream` not supported.
- **Mobile Safari and in-app browsers:** "In-app browsers (Instagram, X, LINE, Facebook) may fail adapter requests or drop GPU extensions" — [Utsubo 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)

### Inferences
- **Production checklist:**
  1. A single "Start show" gesture resumes the AudioContext, starts all videos (muted by default; unmute only in the control window), requests fullscreen and wake lock, and opens outputs.
  2. Handle `device.lost`: tear down the renderer, re-request an adapter, rebuild pipelines, textures and bind groups from a serialisable scene graph (keep the scene model independent of GPU objects), and fall back to WebGL2 if WebGPU keeps failing.
  3. Render in linear space. Choose the output canvas format per display (sRGB 8-bit default; `rgba16float` + extended tone mapping only on Chromium with an HDR display).
  4. Handle high-DPI per output: size each output canvas to `ScreenDetailed.devicePixelRatio × width/height` of its projector, not to the control window's DPR (inference).
  5. Keep every output window visible and fullscreen to avoid occlusion throttling.
  6. Request a Wake Lock in every output window.

### Gaps
- No primary source was gathered on browser behaviour when a projector is hot-plugged during a show (beyond the `screenschange` event) or on GPU-process-crash recovery as distinct from device loss.
- `devicePixelRatio` per `ScreenDetailed` was not verified in BCD.

## 10. Recommended architecture for moving the existing React/TS/Vite PWA (DOM/CSS matrix3d + clip-path + `<video>`) to a GPU compositor

### Takeaway
Keep React only for the control UI. Move all frame output into a **renderer core**: framework-agnostic TypeScript running in a worker via `OffscreenCanvas`, fed by a serialisable scene graph (composition → layers → clips → effects → slices → outputs with warp meshes and blend masks). Use WebGPU (via three.js `WebGPURenderer`/TSL or a thin custom layer) with a WebGL2 fallback. Use two video paths (`<video>`+rVFC for simple clips, WebCodecs+demuxer for frame-accurate clips), and put platform services behind a host interface so the same core runs as a PWA (Chromium-first) and inside Electron.

### Cited Findings
- `OffscreenCanvas` and `transferControlToOffscreen` are available in Chrome 69, Firefox 105, Safari 16.4, so a worker-rendered compositor is portable — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- WebCodecs works in dedicated workers — [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- One `GPUDevice` can drive many canvases — [luma.gl](https://luma.gl/docs/developer-guide/multiple-canvases)
- External video textures must be imported and used within the same task — [Toji](https://toji.dev/webgpu-best-practices/img-textures.html)
- Three.js `WebGPURenderer` can fall back to WebGL2, but it has fallback-specific bugs — [three.js manual](https://threejs.org/manual/en/webgpurenderer.html); [three.js #31950](https://github.com/mrdoob/three.js/issues/31950)
- Multi-screen placement and fullscreen are Chromium-only on the web — [BCD](https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json)
- Electron provides zero-copy `VideoFrame` import of native textures — [Electron sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)

### Inferences
**Layered architecture:**
1. **Scene model** (pure TS, serialisable; lives in a store such as Zustand or Redux):
   - Composition, layers, clips, effects (ISF-like parameter schema), slices, outputs.
   - Warp: corner-pin → grid mesh → Bezier patch control points.
   - Masks: vector paths.
   - Edge-blend parameters (width, curve p, gamma per RGB, black level).
2. **Renderer core** (worker + `OffscreenCanvas` where possible):
   - Per frame: clock tick → pull frames from sources → render each layer to a texture → apply effects (fragment/compute passes) → composite into a composition texture.
   - For each output and slice: sample the composition through the slice's input rect onto its warp mesh, apply the mask, apply the edge-blend ramp, then present.
   - `<video>`-element sources must live on the main thread. Either import them there, or transfer `VideoFrame`s (`new VideoFrame(video)`) to the worker. That is portable, though the per-frame cost is unmeasured.
3. **Source providers:**
   - `HTMLVideoElement` + rVFC (simple loops).
   - WebCodecs decoder pool + Mediabunny demux (frame-accurate, scrubbing, BPM-locked).
   - getUserMedia/getDisplayMedia.
   - Image/ImageBitmap.
   - Desktop-only: Syphon, Spout and NDI via the Electron sharedTexture path.
4. **Output manager:**
   - PWA/Chromium: `getScreenDetails` + popups + `requestFullscreen({screen})`. Each output window hosts a canvas, rendered either by its own renderer instance with state replicated over BroadcastChannel/SharedArrayBuffer, or (if verified) by the shared device.
   - Electron: native `BrowserWindow` per display.
5. **Host services interface:**
   - Methods: `listDisplays/openOutput`, `midi`, `osc/artnet/link` (WebSocket to a companion in PWA, IPC in Electron), `mediaLibrary` (FSA handles vs native fs), `textureIO` (Syphon/Spout/NDI).
6. **Clock:** a single master clock (performance.now, optionally slaved to Link/MIDI clock) in the control context. Outputs render on their own rAF but sample the shared clock for sync.

**Migration order:**
1. Mirror the current DOM renderer's features (corner-pin, clip masks, video) in the GPU renderer behind a feature flag.
2. Add mesh warp and edge blending.
3. Add the WebCodecs path.
4. Add multi-output windows.
5. Build the Electron host.
6. Add HAP and native texture I/O.

Keep the DOM renderer as a debug/fallback view until GPU parity is reached.

### Gaps
- There is no measured data on worker vs main-thread rendering throughput with many `<video>` sources (`VideoFrame` transfer cost per frame).
- Cross-window shared `GPUDevice` rendering is unverified (see section 3).
