# Professional Live-VJ / Visual-Performance Software: Feature Matrix (state as of Oct 2026)

Scope: Resolume Avenue and Arena (7.x, current 7.28), VDMX6 / VDMX6 Plus, Modul8 v3, Synesthesia (v1.25.x), Smode (Community / Compose / Live), and TouchDesigner (2025 Official builds plus community VJ systems). The focus is the performance (VJ) side. Mapping is mentioned only where it is core to the product.

Notes on dating and reliability:
- Research date: 2026-10-15.
- Each item says which version or date it comes from where the source gives one. Items marked "(older)" predate 2024.
- Matrix cells read: "Yes" = documented in a cited source, "No" = documented as absent, "?" = not verified in this research.
- Many vendor pages were read through a summarising fetch tool, so short quotes are as returned by that tool.
- Release dates: Resolume blog posts show no dates. Dates for 7.27 and 7.28 come from third-party sources, as cited.

---

## 1. Content model, clip triggering, transport, autopilot, transitions/crossfader, blend modes

### Takeaway
Resolume has the most complete clip-launcher model. It is built from compositions, layers, columns, decks, clips and groups (groups are Arena-only). It adds per-clip trigger styles (normal/piano), Beat Snap quantisation, Autopilot (next/previous/random/specific clip, now with transition compensation), and per-clip transition time and blend mode (since 7.25). VDMX has an equally deep but modular model (layers, Media Bin with Monophonic/Cycle/Polyphonic triggering, a Two Channel Mixer plugin, Cue Lists). Synesthesia is scene/preset-centric and does not use a clip grid. TouchDesigner has no built-in VJ model, so community systems (e.g., SonomikaTD) recreate the Resolume-style layer/column grid.

### Cited Findings

**Resolume Avenue/Arena (7.x)**
- Clip trigger styles: "Normally, when you click a clip, it starts playing and carries on until you clear the layer or play another clip." In **Piano** mode, the layer clears when the mouse button, MIDI key or keyboard key is released. The manual page does not describe toggle or one-shot styles. — [Resolume manual: Clips](https://www.resolume.com/index.php/support/en/7/clips)
- Column triggering: "You can trigger multiple clips at the same time by triggering the column." — [Resolume manual: Clips](https://www.resolume.com/index.php/support/en/7/clips)
- **Beat Snap**: a clip can wait for "the next beat, the next bar, in 2 bars, in 4 bars and so on, before it starts." It is set per clip or per composition, with a "Composition determined" default. — [Resolume manual: Clips](https://www.resolume.com/index.php/support/en/7/clips)
- **Auto Pilot**: "let Resolume automatically play a different clip when the current clip finishes." Options are next clip, previous clip, random clip, first or last clip in the layer, or a specific clip. There is a "Loops" count before the action fires, and a "Layer Determined" default. — [Resolume manual: Clips](https://www.resolume.com/index.php/support/en/7/clips)
- Known friction: Autopilot does not fire when a piano-mode clip is released, only when a clip plays to its end. A user requested this as a feature in the forum. — [Resolume forum thread](https://resolume.com/forum/viewtopic.php?p=40466) (user-generated; version unclear)
- 7.27 (July 2026, see the dating note below) added **Autopilot Transition Compensation**: "Autopilot starts the next clip early so the transition finishes as the current clip ends." — [Resolume 7.27 release post](https://resolume.com/blog/34561)
- 7.25 (early 2026) added "Individual transition time and blend mode per clip … we've added a Transition tab to the Clip panel." — [Resolume 7.25 release post](https://resolume.com/blog/34172)
- 7.28 added a **Depth Blend Mode** that "mixes two layers by their depth maps instead of by opacity." — [Resolume 7.28 release post](https://resolume.com/blog/34630)
- Transport and parameter timeline: Timeline mode lets you "play forwards, backwards, control the speed and duration, set in & out points." Loop modes are looping, ping-pong, random frames and one-shot. "Clip Position" mode syncs a parameter to the clip playhead, including scrubbing, speed, direction and beatloop. — [Resolume manual: Parameter Animation](https://resolume.com/support/en/parameter-animation)
- A crossfader exists. "Crossfader Phase" is an animation source in the Composition, Layer or Group panels that uses the crossfader position from 0 to 100%. — [Resolume manual: Parameter Animation](https://resolume.com/support/en/parameter-animation)
- **Groups** are listed as **Arena-only**. The other Arena-only features are Projection Mapping, Edge Blending, SMPTE Timecode input, Denon StageLinq, Pioneer Pro DJ Link, DMX Control, DMX Fixture Output, Capture Card Output and Slice Transforms. — [Resolume: Difference between Avenue and Arena](https://resolume.com/support/en/avenue-arena-difference)
- Clip thumbnails can be set to the current frame, to the frame with effects applied, or to a still image from disk. — [Resolume manual: Clips](https://www.resolume.com/index.php/support/en/7/clips)
- Dating: 7.28 was released on Sept 21, 2026 per [letsdatascience](https://letsdatascience.com/news/resolume-728-adds-computer-vision-effects-to-live-visual-too-ac88953e), and covered by [CDM on Sept 25, 2026](https://cdm.link/?p=167917). A third-party download site lists 7.27.1 as July 18, 2026 ([FileHorse](https://mac.filehorse.com/download-resolume-avenue/old-versions/)). The Resolume blog index lists the 7.22–7.28 releases without dates ([Resolume blog](https://www.resolume.com/blog)).

**VDMX6 / VDMX6 Plus (macOS)**
- Works with "any number of layers at a time." Each layer has blend mode, crop, perspective correction and opacity, and "layers can be grouped for compound effects." — [vidvox.net](https://vidvox.net/)
- The **Media Bin** plugin "imports, organizes, and triggers clips." Its trigger modes are "Monophonic", "Cycle" and "Polyphonic". — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- The **Two Channel Mixer** plugin "crossfades the opacity of two layers," which is VDMX's A/B crossfader. — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- The **Cue List** plugin "schedules clip triggers and data-source changes over time, with CSV import and export." — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- **Plugin Templates** (VDMX 6.3, July 2, 2026) let you save and reuse the state of an individual plugin. — [VDMX blog: Announcing VDMX 6.3](https://vdmx.vidvox.net/blog/announcing-vdmx-63)

**Modul8 v3 (macOS)**
- "Each piece of media is a layer that can be manipulated in real time." Effects, colors, shapes and animations can be combined. — [garagecube.com/modul8](https://www.garagecube.com/modul8/)
- v2 (2005) "introduced a module system, allowing customization of the software interface." — [Wikipedia: Modul8](https://en.wikipedia.org/wiki/Modul8) (older info; article last edited 2021)

**Synesthesia (v1.25.x)**
- Model: Scenes are "GLSL fragment shaders that create visuals with code." The Control Panel has three banks: Scene Controls, Meta Controls and Media. — [Synesthesia Docs](https://app.synesthesia.live/docs/), [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html)
- Media is "mixed _into_ the current scene rather than replacing it." It has overlay blend modes, a strength control and loop modes (Repeat, Play Once, Play Next). Media Lock keeps media across scene changes. — [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html)
- Presets capture the scene look, meta controls and media. **FavSlots** are one-click preset shortcuts that can be mapped to MIDI/OSC. **Playlists** are ordered scene-preset pairs with per-item HH:MM:SS countdowns. "Auto-Transition" advances "when the music reaches a breakdown or drop." Shuffle Mode randomises the order. — [Docs: Presets, FavSlots & Playlists](https://app.synesthesia.live/docs/manual/presets.html)
- Scene-to-scene crossfade/transition settings are not documented on the controls or presets pages. — [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html), [Docs: Presets](https://app.synesthesia.live/docs/manual/presets.html)

**Smode (Windows)**
- The "Animate" module covers "timeline and cueing, 'From full live to fully pre-programmed'." The Live tiers list "Cue list" and "Linear & Non-linear Animation." — [smode.io](https://www.smode.io/en), [Smode Live page](https://www.smode.io/en/product/live-media-server)
- Smode describes itself as a "Live compositing and media server platform" built around 2D/3D compositing (Compose module). — [smode.io](https://www.smode.io/en)

**TouchDesigner (community VJ systems)**
- **SonomikaTD** (posted July 28, 2026; free via Patreon) offers a "Flexible layer and column performance grid," "Up to 32 separate scenes," crossfading between columns, stackable TOX effects per cell, and global effect chains per scene. — [derivative.ca: SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106)
- A community "5-layer VJ system" ships with a custom control UI and is pre-mapped for an AKAI APC mini mk2. — [derivative.ca: Versatile VJ system](https://derivative.ca/community-post/asset/release-versatile-vj-system-5-layer-control-custom-ui/73834)
- okVJ, a modular live-visual toolkit by Supermarket Sallad and VJ BunBun with instant MIDI mapping and audio reactivity, was used at the TouchDesigner Montréal meetup on Oct 19, 2025. — [derivative.ca: Montréal meetup highlights](https://derivative.ca/community-post/asset/touchdesigner-meetup-montr%C3%A9al-%E2%80%94-highlights-resources-oct-19-2025/73213)

### Inferences
- **Content-model matrix:**

| Capability | Resolume Avenue | Resolume Arena | VDMX6 | Modul8 v3 | Synesthesia | Smode Live | TouchDesigner |
|---|---|---|---|---|---|---|---|
| Layer stack with blend modes and opacity | Yes | Yes | Yes | Yes (layers) | Media layer over scene only | Yes (compositing) | Build-your-own / community |
| Clip grid (layers × columns) | Yes | Yes | Media Bin (not a grid) | ? | No (scenes/presets/FavSlots) | ? | Community (SonomikaTD) |
| Column / scene trigger | Yes | Yes | ? | ? | Playlist / FavSlot | Cue list | Community |
| Layer groups | **No (Arena-only)** | Yes | Yes | ? | No | ? | n/a |
| Trigger styles | Normal / Piano | Normal / Piano | Mono / Cycle / Poly | ? | n/a | ? | n/a |
| Beat-quantised launch | Beat Snap | Beat Snap | ? | ? | Auto-Transition on drop | ? | n/a |
| Autopilot / follow actions | Yes (+transition comp. 7.27) | Yes | Cue List | ? | Playlists + countdown | Cue list | n/a |
| Per-clip transition time and blend | Yes (7.25) | Yes | ? | ? | ? | ? | n/a |
| A/B crossfader | Yes | Yes | Two Channel Mixer | ? | ? | ? | Community |

- Table stakes for a pro-grade VJ tool: a layer stack with blend modes and opacity, a clip/scene launcher, beat-quantised triggering, a crossfader, and some follow-action/autopilot. Resolume's grid (layers × columns, column trigger, Beat Snap, Autopilot) is the de-facto mental model users expect. Community TouchDesigner systems copy it ("layer and column performance grid").
- Differentiators: per-clip transitions (Resolume 7.25), autopilot transition compensation (7.27), depth-based blend modes (7.28), Synesthesia's music-structure-aware "Auto-Transition at breakdown/drop", and VDMX's Cue List with CSV import/export.
- Synesthesia shows a lighter "scene + preset + playlist" model that works well for DJs and streamers. A browser tool could offer both a grid mode and a playlist/autopilot mode.

### Gaps
- No official Resolume manual page confirmed cue points within clips, a "toggle" or "one-shot" trigger style, or the full clip-transport options (direction buttons, speed, BPM-sync vs timeline vs SMPTE per clip). The [Clip Time Panel](https://resolume.com/support/en/clip-time-panel) article was not fetched.
- Modul8 v3 layer count, groups/crossfader and media-set structure could not be confirmed from current primary sources.
- Smode's VJ-style clip-triggering model (grid vs cue list) is not documented on the pages fetched.
- Synesthesia's scene-to-scene transition/crossfade behaviour is not documented on the pages fetched.

---

## 2. Effects and sources: counts, generators, shader formats, live inputs, codecs (and why GPU-decoded codecs matter)

### Takeaway
Every serious tool ships 80–100+ GPU effects/generators and exposes a shader plugin format: FFGL (Resolume), ISF/GLSL (VDMX native, Resolume Wire, Synesthesia import, Smode), SSF (Synesthesia's GLSL dialect), or TOX/TOPs (TouchDesigner). Live inputs via webcam/capture card, NDI and Syphon/Spout are universal. GPU-decoded intra-frame codecs (HAP family, Resolume's DXV3, NotchLC) are the performance baseline. They move decompression to the GPU and make random-access scrubbing cheap. The 2025–26 trend is ML/computer-vision effects: VDMX Remove Background and Video Tracking, Resolume 7.28 segmentation and depth.

### Cited Findings

**Resolume**
- "over a 100 built-in video effects" and "a handful of audio effects." "For video, Resolume supports FFGL plugins," which must be 64-bit for Resolume 6 and up. — [Resolume manual: Effects](https://resolume.com/support/en/effects)
- Sources "generate content on the fly and are an alternative to video clips." Capture devices include laptop webcams. NDI, Spout and Syphon are "essentially virtual video patch cables." — [Resolume manual: Sources](https://resolume.com/support/en/sources)
- Avenue "supports playback of video and audio files, live cameras, and over a hundred effects and sources." — [Resolume: Avenue/Arena difference](https://resolume.com/support/en/avenue-arena-difference)
- NDI: "NDI inputs are always enabled in Resolume." The network is the only limit on input count. — [Resolume manual: NDI](https://resolume.com/support/en/NDI_inputs_and_outputs)
- **Wire** is Resolume's node-based patcher (sold separately at €399, see section 7). It hosts ISF: 7.28.1 fixed "Edit ISF being disabled on Windows" and "ISF Fragment Shader menu" ([7.28 post](https://resolume.com/blog/34630)). The 7.26 Wire MCP server "can … write ISF shaders" ([7.26 post](https://resolume.com/blog/34484)). Newer built-in effects are written in Wire, for example "a CRT effect built in Wire" (7.24, likely late 2025) ([Resolume blog index](https://www.resolume.com/blog)).
- 7.28 computer-vision effects: Wire nodes "Human Segmentation" and "Depth Estimation." Arena/Avenue effects Background Removal, Depth Estimation, Depth Blur, Depth Field, Depth Displace, Depth Pixelation and Depth Shift. Each effect is an editable Wire patch. — [Resolume 7.28 post](https://resolume.com/blog/34630), [CDM, Sept 25 2026](https://cdm.link/?p=167917)
- FFGL SDK: the Resolume fork calls "FFGL 2.2" "the most recent released version of the sdk." The master branch allows "OpenGL 4.6 extensions." Plugins load in "Resolume 7.0.3 and up." The SDK supports Effect and Source plugins, macOS and Windows, under a BSD-3-Clause license. — [github.com/resolume/ffgl](https://github.com/resolume/ffgl)
- DXV3 is "a hardware (GPU) accelerated codec. The decompression of the video frames is done directly on the video card." It allows "much higher resolutions and frame-rates, with much lower CPU and RAM usage." Resolume recommends Normal quality and warns: "Expect file size to double when encoding to DXV3 HQ!" Alpha variants exist. "Playback of video files with the DXV codec is only hardware accelerated when played in Resolume." — [Resolume manual: Rendering to DXV](https://resolume.com/support/en/rendering-to-dxv)
- The free **Alley** converter is "the easiest way to create DXV encoded files," and Adobe export plugins are included. — [Resolume article 67](https://resolume.com/article/67)
- Older forum comments (undated) say: H.264 interframe compression makes seeking slow, whereas "HAP and DXV3 just use intraframe compression, so they are quicker to find a frame." HAP/HAP Alpha play at DXV-like frame rates in Resolume. A developer said "Hap Q has quality far beyond anything currently in DXV – but then so are its data-rates." — Resolume forum threads [p=39477](https://resolume.com/forum/viewtopic.php?p=39477), [p=39821](https://resolume.com/forum/viewtopic.php?p=39821), [p=39822](https://resolume.com/forum/viewtopic.php?p=39822) (older; the exact quote-to-thread mapping comes from a search summary)

**VDMX6**
- Supports "GLSL shaders through the Interactive Shader Format, plus CoreImage, Quartz Composer, Vuo, and TouchDesigner." Sources include live cameras, capture cards, Syphon, "Window Grabber" sources and NDI streams. — [vidvox.net](https://vidvox.net/)
- VDMX6 Plus adds TouchDesigner and Vuo compositions as generators, effects and control data sources. TouchDesigner compositions require a paid TD license (Education/Commercial/Pro) on the same machine. Quartz Composer is deprecated. — [VDMX6 launch post (Sept 12, 2024)](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337), [VDMX docs](https://docs.vidvox.net/vdmx/)
- **HAP R** (technically HAP 7A, based on BC7) was introduced with VDMX6. It produces "files that are higher quality than HAP Q, with alpha channels, at about the same size." VDMX6 moved rendering from OpenGL to Metal. — [VDMX6 launch post](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337)
- Codecs: "All variations of the HAP codecs are supported for playback and encoding." HAP "typically gives the best performance, especially with three or more HD layers." ProRes needs Apple Pro Video Formats. H.264 is "hardware accelerated when possible" with a 4K max. For alpha recording, "HAP Alpha, HAP Q Alpha or ProRes 4444." — [VDMX docs: Video Codecs](https://docs.vidvox.net/vdmx/vdmx_video_codecs)
- Recent FX additions:
  - Apr 7, 2025: Video Tracking (faces/hands/bodies), Scopes, OCR, Color Transfer, Remove Background, Blur and Overlay Faces. — [VDMX blog](https://vdmx.vidvox.net/blog/vdmx6-update-video-tracking-ocr-scopes-color-transfer-and-more)
  - Aug 13, 2025 (6.2): direct audio capture from other apps and bundled ProjectMilkSyphon (MilkDrop). — [VDMX blog](https://vdmx.vidvox.net/blog/vdmx-6-2-update)
  - July 2, 2026 (6.3): Chromatic Aberration, JPEG Block Corruption and Triangle Mosaic FX, plus Worley Cells, Simplex Noise and Ridgelines generators. — [VDMX blog](https://vdmx.vidvox.net/blog/announcing-vdmx-63)
- "ISF for Metal, now open source!" (Mar 21, 2025): ISFMSLKit and VVMetalKit were released. — [VDMX blog](https://vdmx.vidvox.net/blog/isf-for-metal)

**Modul8**
- Python scripting and modules ("dozens of open source modules … available for free"). Syphon sharing with MadMapper. — [garagecube.com/modul8](https://www.garagecube.com/modul8/)
- A 3.0 RC1 changelog (June 2018) lists fixes for "Syphon/NDI output problems," which implies NDI output exists. — [Softpedia changelog](https://mac.softpedia.com/progChangelog/Modul8-Changelog-8394.html) (older; seen via search snippet, page returned 403 on fetch)

**Synesthesia**
- "80 built-in scenes" plus "20+ free scenes" on the Scene Marketplace ([synesthesia.live](https://synesthesia.live/)). The pricing page instead says "100+ built-in and free scenes from 20+ artists" ([synesthesia.live/pricing](https://synesthesia.live/pricing)), a minor discrepancy.
- Imports from Shadertoy and ISF. The live-coding environment uses SSF (Synesthesia Shader Format: GLSL plus JSON config plus optional JavaScript scripting). — [synesthesia.live](https://synesthesia.live/), [Synesthesia Docs](https://app.synesthesia.live/docs/)
- Inputs: "Any USB camera or HDMI/SDI capture card recognized by your OS." Syphon/Spout input allows one source at a time. NDI input/output requires Pro and allows one NDI input at a time. Playback formats are .mp4/.mov/.gif/.png/.jpg. HAP and DXV are recommended as "GPU-accelerated, allowing very high resolutions with low CPU impact." — [Synesthesia FAQ: Video](https://app.synesthesia.live/docs/faq/video.html)

**Smode**
- Open-protocols page (per its URL): NDI, Spout, PosiStageNet, Python and ISF shaders. — [smode.io open protocols](https://www.smode.io/en/tech-partners/open-protocols-ndi-spout-posistagenet-python-isfshaders) (the page body could not be fully parsed; the protocol list comes from the URL slug and a search snippet)
- A search snippet says NDI and Spout are supported "with no limitations on the number of feeds and their resolution, except the hardware capabilities." — [smode.io open protocols](https://www.smode.io/en/tech-partners/open-protocols-ndi-spout-posistagenet-python-isfshaders) (snippet, not verified in full text)
- Notch Blocks, TouchDesigner and Unreal integrations are available on all versions except the free Community edition. — [Smode FAQ](https://www.smode.io/en/faq)

**TouchDesigner**
- Movie File In TOP supports "Hap Q formats (including Hap Q with Alpha)" and NotchLC. "Hap and NotchLC codecs … are always hardware decoded." It supports NVIDIA hardware decode for H.264/H.265 (including 10/12-bit and 4:4:4), VP8, VP9, AV1 and others. "High Performance Read" is recommended for "high resolution (4K+) HAP Q files." — [TD docs: Movie File In TOP](https://docs.derivative.ca/Movie_File_In_TOP)
- The 2025 Official build (Oct 2025) introduced Point Operators (POPs). — [derivative.ca: What's new 2025](https://derivative.ca/community-post/whats-new-2025-touchdesigner-release/73348), [TD Release Notes](https://docs.derivative.ca/Release_Notes)
- Community VJ systems load "standard TouchDesigner TOX files" as effects. — [SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106)

**Specs**
- HAP: "a set of video codecs for macOS, Windows and Linux that performs decompression using a computer's graphics hardware." It matters most "when working with multiple high resolution videos in real-time." It is supported "in over two dozen of the most popular media servers, real-time video applications, and creative coding environments," via AVFoundation, QuickTime, FFmpeg, LibAV and DirectShow. — [hap.video](https://hap.video/)
- ISF: "a simple file format that combines a GLSL shader with metadata that describes how to execute and interact with it." It supports "multi-pass rendering, persistent buffers, and floating-point intermediate or output formats." It has been updated for Metal and is supported "in nearly a dozen of the most popular media servers." — [isf.video](https://isf.video/)

### Inferences
- **Effects/sources matrix:**

| Capability | Resolume | VDMX6 | Modul8 | Synesthesia | Smode | TouchDesigner |
|---|---|---|---|---|---|---|
| Built-in FX count | 100+ video + audio FX | ? (many; new FX each release) | ? | 80–100+ scenes; FX count ? | ? | Hundreds of operators (not a "FX list") |
| Plugin/shader format | FFGL 2.2; ISF via Wire | ISF (native), CoreImage, Vuo, TD (Plus), QC (deprecated) | Python modules | SSF (GLSL+JSON+JS); ISF/Shadertoy import | ISF, Python, Notch Blocks, TD | GLSL TOP, TOX components |
| Node patcher | Wire (separate license) | No (modular UI) | No | No | Yes (compositing graph) | Yes (core paradigm) |
| Webcam/capture | Yes | Yes | ? | Yes | ? | ? |
| NDI in | Yes | Yes | ? (out per 2018 changelog) | Pro only | Yes | ? |
| Syphon/Spout in | Yes | Syphon (macOS) | Syphon | Yes (1 at a time) | Spout | ? |
| HAP family | Yes (per forum) | All variants incl. HAP R | ? | HAP/DXV recommended | ? | HAP Q/HAP Q Alpha, NotchLC |
| Proprietary GPU codec | DXV3 | HAP R (open family) | — | — | — | — |
| ML/CV effects (2025–26) | Segmentation and depth (7.28) | Tracking, remove BG, OCR | No | No | ? | Community components |

- Why GPU-decoded codecs matter (synthesis of the [DXV](https://resolume.com/support/en/rendering-to-dxv), [HAP](https://hap.video/), [VDMX codec](https://docs.vidvox.net/vdmx/vdmx_video_codecs) and [TD Movie File In](https://docs.derivative.ca/Movie_File_In_TOP) docs):
  - Frames are stored as GPU texture-compressed (DXT/BC-style) intra-frames. The CPU does a light unpack and the GPU does the rest, which frees CPU for many simultaneous HD/4K layers.
  - Every frame is a keyframe, so reverse play, scratching, random-frame, BPM-synced loops and instant cueing are cheap. Long-GOP H.264 is not.
  - The trade-off is large files and disk throughput (VDMX and TD both warn about storage speed).
- Browser implication (inference from general web-platform knowledge, not researched here):
  - Browsers hardware-decode H.264/VP9/AV1 through `<video>`/WebCodecs but have no native HAP/DXV.
  - Achieving "HAP-like" scrubbing would need all-intra encodes (e.g., all-keyframe H.264/VP9), WebCodecs frame caching, or a custom HAP decoder (Snappy in WASM plus compressed-texture upload via WebGL/WebGPU BC extensions, which are desktop-only).
  - This is likely a key technical differentiator or risk for a web VJ tool.
- ISF is the closest thing to a cross-vendor shader standard: VDMX native, Resolume Wire, Synesthesia import, and Smode per its open-protocols page. Supporting ISF import in a browser (WebGL GLSL ES) is a cheap, high-value interoperability feature. FFGL is native-binary and not portable to the web.
- Computer-vision effects (background removal, depth, body tracking) moved from differentiator toward expected-soon in 2025–26: both VDMX and Resolume shipped them. In a browser, MediaPipe/ONNX-web could plausibly match this (inference).

### Gaps
- No official Resolume page confirming HAP/HAP Q/HAP Alpha/HAP R support or ProRes performance. Evidence is older forum posts.
- Exact built-in effect counts for VDMX6, Modul8, Smode and Synesthesia post-FX were not found.
- Text/title generators: not verified for any product in this research. Resolume has text sources per older blog posts (e.g., "Shape & Text Nodes" in Wire 7.4.1, title only seen in search), but no current text-generator page was fetched.
- TouchDesigner NDI In/Out TOP, Syphon Spout In/Out TOP and Video Device In TOP were not fetched in this pass. They are standard operators, but the writer should verify against docs.derivative.ca if needed.

---

## 3. Tempo and reactivity: BPM, Ableton Link, MIDI clock, audio analysis, LFOs/envelopes/sequencers

### Takeaway
BPM tap/sync, Ableton Link and FFT-band audio reactivity are table stakes across all products. Resolume adds Beat Snap, BPM-synced parameter animation, per-clip/layer/group/composition FFT, DJ-hardware sync (Denon StageLinQ, Pioneer Pro DJ Link; Arena-only), and calls MIDI clock "notoriously wavy." VDMX has the richest modulation toolkit (LFO, Step Sequencer, Data Looper, Clock with BPM detection, Link and MIDI clock out, and Control Surface expressions). Synesthesia's differentiator is a deep, pre-tuned audio engine: 38 audio uniforms across 4 bands, BPM sine/triangle phases, and "Intensity"/"FadeInOut" large-scale features.

### Cited Findings

**Resolume**
- Parameter animation modes:
  - Timeline.
  - BPM Sync, "time is in beats."
  - Clip Position.
  - Audio Analysis (FFT): External FFT (audio input device), Composition FFT, and Clip/Layer/Group FFT.
  - Crossfader Phase.
  - Envelope ("can be applied to all animations").
  - Dashboard.
  - FFT controls: L/M/H band buttons plus in/out points on the spectrum, Gain, Fall, and direction modes.
  - "Start Settings": composition load, clip trigger, column trigger, or manual.
  
  — [Resolume manual: Parameter Animation](https://resolume.com/support/en/parameter-animation)
- 7.28 added "Group FFT" as a clip and layer animation source. Roadmap: "We're currently improving our audio engine and the first thing is FFT audio reactivity in Arena." — [Resolume 7.28 post](https://resolume.com/blog/34630)
- Ableton Link (View > Show Ableton Link) keeps "the BPM and the current position in the measure in sync between all connected computers." Resync and Pause are disabled while Link is active. — [Resolume manual: Ableton Link](https://resolume.com/support/en/link) (page tagged v6)
- A forum thread reports that Resolume's Link "grabs tempo but can't push its own resync or pause back out." — [Resolume forum](https://resolume.com/forum/viewtopic.php?p=84352) (via search summary)
- MIDI clock input: Resolume follows Clock Start and Ticks. Clock Stop either halts the BPM or switches to manual. The manual calls MIDI Clock "notoriously wavy and not really accurate" and recommends Link. — [Resolume manual: MIDI Shortcuts](https://resolume.com/support/en/midi-shortcuts)
- Denon StageLinQ is "Available on Resolume Arena only!" and syncs up to 4 players. — [Resolume: Sync to Denon DJ Players](https://resolume.com/article/79). Pioneer Pro DJ Link is also Arena-only. — [Resolume: Avenue/Arena difference](https://resolume.com/support/en/avenue-arena-difference)
- Dashboard: dials at the top of the Clip, Layer, Group and Composition panels. "You can add multiple parameters to the same dashboard dial," each with in/out range, invert and dial range, and it works with toggles, dropdowns and color palettes. — [Resolume manual: Dashboard](https://resolume.com/support/en/dashboard)

**VDMX6**
- The Clock plugin provides "BPM timing from internal tempo, MIDI follow, or BPM detection, with 'Ableton Link' and MIDI clock output." The Audio Analysis plugin "converts an audio input into data sources, including frequency-band filters." Other plugins:
  - LFO ("built-in functions or custom curves").
  - Step Sequencer (index/number/boolean/color tracks).
  - Data Looper ("records input data into quantized tracks").
  - Control Surface with Expressions.
  
  — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- BPM detection was rewritten to run natively on Intel and ARM64 in VDMX6. — [VDMX6 launch post](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337)
- 6.3 (July 2, 2026): "Control Surface Expressions" are scriptable float, boolean, 2D point and RGBA data-sources powered by ExprTk. — [VDMX 6.3](https://vdmx.vidvox.net/blog/announcing-vdmx-63)
- 6.2 (Aug 13, 2025): audio capture directly from other applications. — [VDMX 6.2](https://vdmx.vidvox.net/blog/vdmx-6-2-update)

**Modul8**
- "audio-signal control of parameters, and a beat generator for rhythmic cues." — [garagecube.com/modul8](https://www.garagecube.com/modul8/)

**Synesthesia**
- The audio engine exposes **38 audio uniforms + 2 data textures** (`syn_Spectrum` with raw/juiced/smooth FFT and waveform, and `syn_LevelTrail`). The four FFT bands are Bass, Mid, MidHigh and High. Uniform groups are Level, Hits, Time, Presence, Beat (`syn_OnBeat`, `syn_ToggleOnBeat`, `syn_RandomOnBeat`, `syn_BeatTime`), BPM (`syn_BPM`, `syn_BPMConfidence`, BPM-synced sine/triangle at 1/2/4/8), and "Large Features" (`syn_FadeInOut`, `syn_Intensity`). — [Synesthesia Docs: Audio Uniforms](https://app.synesthesia.live/docs/ssf/audio_uniforms.html)
- The Pro "Reactivity" and "Audio Speed" meta controls. — [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html)
- Audio input options: audio interface, Windows Desktop Audio, or macOS loopback software such as BlackHole. Signal below 1% or clipped at 100% breaks the engine. — [Synesthesia FAQ: Audio](https://app.synesthesia.live/docs/faq/audio.html)
- Pro OSC output "exposes the Synesthesia Audio Engine to other software." — [Synesthesia FAQ: MIDI & OSC](https://app.synesthesia.live/docs/faq/midi_osc.html)
- A user reports "41 SSF audio uniforms over OSC" (a different count from the docs' 38, possibly including the textures or the version). — [TroikaTronix forum](https://community.troikatronix.com/post/49692)

**Smode**
- Live tiers list "Make anything audio reactive" and "BPM Tap Tempo." — [Smode Live page](https://www.smode.io/en/product/live-media-server)
- "Link to Audio Spectrum": the extraction zone is set with bars, "horizontal being the frequency range, and vertical the amplitude range," plus a Smooth modifier and an Audio function usable in masks and modifiers. — [Smode docs: Audio interactivity](https://doc.smode.io/userGuide/tutorialsAndHow-Tos/connectionAndInteractivity/audioInteractivity/)

**TouchDesigner**
- The Ableton Link CHOP outputs peer count and sync status plus "a 0-1 ramp each bar, and a pulse each bar." Link can fail with DirectX audio drivers. — [TD docs: Ableton Link CHOP](https://docs.derivative.ca/Ableton_Link_CHOP)
- TDAbleton integrates deeply with Ableton Live over OSC and includes abletonLevel for per-track levels and spectrum. — [TD docs: TDAbleton](https://derivative.ca/UserGuide/TDAbleton)
- Community beat-tracking components:
  - "lastBeatStanding" (AI-based beat/bpm/phase; requires 2025.32280+). — [derivative.ca](https://derivative.ca/community-post/asset/last-beat-standing-rocksolid-ai-based-realtime-beat-detection/74246)
  - EssentiaTD (onset/BPM). — [derivative.ca](https://derivative.ca/community-post/asset/essentiatd/75075)
- The community 5-layer VJ system gets audio analysis from Sound2Light over OSC. — [derivative.ca](https://derivative.ca/community-post/asset/release-versatile-vj-system-5-layer-control-custom-ui/73834)

### Inferences
- **Tempo/reactivity matrix:**

| Capability | Resolume | VDMX6 | Modul8 | Synesthesia | Smode Live | TouchDesigner |
|---|---|---|---|---|---|---|
| Tap/manual BPM | Yes | Yes | Beat generator | Yes (BPM uniforms) | Tap tempo | Beat CHOP / build |
| Auto BPM detection from audio | ? | Yes | ? | Yes (`syn_BPM`, confidence) | ? | Community (AI) |
| Ableton Link | Yes (tempo + bar position) | Yes | ? | ? | ? | Yes (CHOP) |
| MIDI clock | In | Follow + out | ? | ? | ? | ? |
| DJ-hardware sync | Denon / Pioneer (Arena) | ? | ? | ? | ? | ? |
| FFT bands | L/M/H + custom range, per clip/layer/group/comp | Freq-band filters | Audio control | 4 bands + whole | Custom spectrum zone | Audio Spectrum / community |
| Envelope / LFO / sequencers | Envelope, Timeline, BPM-sync | LFO, Step Seq, Data Looper, Expressions | ? | Built into uniforms | Linear/non-linear animation | Everything (build) |
| Macro dashboard | Dashboard dials | Control Surface | Modules | Meta controls | ? | Custom UI |

- Table stakes: tap tempo, Ableton Link, beat-synced parameter animation, FFT with at least low/mid/high bands plus gain/decay (Resolume's "Gain"/"Fall"), LFOs, and macro dials linking several parameters.
- Differentiators: music-structure features (Synesthesia's `syn_Intensity`, `syn_FadeInOut`, Auto-Transition on drops), AI beat tracking (TD community), DJ-hardware sync (Arena), recordable control-data loops (VDMX Data Looper), and expression scripting (VDMX 6.3).
- Browser implication (inference): Web Audio's AnalyserNode makes FFT and envelope following straightforward. Ableton Link needs a native bridge (e.g., a companion app or WebSocket relay) because browsers cannot join Link's UDP multicast. Web MIDI makes MIDI clock input feasible in Chromium. Resolume's own manual recommends Link over MIDI clock.

### Gaps
- Not confirmed: Synesthesia Ableton Link or MIDI clock support, Smode Link support, Modul8 Link support, or Resolume automatic BPM detection from audio.
- Smode documentation of beat detection and FFT-band presets was not found in the fetched page.

---

## 4. Control: MIDI learn, OSC, DMX/Art-Net in, keyboard, controller presets, web/remote/REST, timecode

### Takeaway
MIDI learn with LED feedback, OSC and keyboard mapping are universal. DMX input (lighting-desk control) and SMPTE/LTC timecode are pro-tier features (Arena-only in Resolume; built into VDMX; in all Smode Live tiers). Resolume is the clear leader in programmatic remote control:
- REST API and built-in web server since 7.8 (Dec 2021).
- WebSocket API.
- An expanded REST API in 7.26 with live output snapshots.
- Local MCP servers for AI assistants (7.26, 2026).

VDMX's OSCQuery publishing and client is the main alternative.

### Cited Findings

**Resolume**
- MIDI "Shortcut mode" is learn-style: click the control, then move the hardware. Esc exits. A MIDI monitor is available. Shortcut targets are By Position, This Clip/Layer/Group, or Selected. — [Resolume manual: MIDI Shortcuts](https://resolume.com/support/en/midi-shortcuts)
- Controller presets: "Resolume ships with a few default shortcut layouts," naming APC40Mk2, APC Mini and nanoKONTROL2. Presets are XML files. Velocity-based LED colour feedback uses lookup tables, and clip-trigger shortcuts have five states with separate colours. — [Resolume manual: MIDI Shortcuts](https://resolume.com/support/en/midi-shortcuts)
- Separate manual chapters exist for OSC, DMX Shortcuts (DMX input) and keyboard shortcuts/modifiers. — [Resolume manual index](https://resolume.com/support/en/7), [Resolume support index](https://resolume.com/support/avenue-arena)
- DMX Control (input from a lighting desk) is Arena-only. — [Avenue/Arena difference](https://resolume.com/support/en/avenue-arena-difference)
- REST API (7.8): "With the REST-API you can get and set any parameter value in the composition and you can even get clip thumbnail images!" It is enabled in Preferences > Webserver, and bundled example web pages include a clip-triggering remote. — [Resolume 7.8 blog](https://www.resolume.com/blog/21137/resolume-7-8-control-amp-monitor-arena-avenue-and-wire-via-the-rest-api), [Resolume: REST API & Webserver](https://resolume.com/article/132), [CDM Dec 2021](https://cdm.link/2021/12/resolume-7-8s-rest-api-turns-your-visual-tools-into-web-servers-you-can-access/)
- A WebSocket API is also available ("works slightly different from the REST API"). — [Resolume: Websocket API](https://resolume.com/support/en/websocket-api)
- 7.26 REST additions:
  - Audio-effect management.
  - A "monitors endpoint" giving live output snapshots as PNG/JPEG.
  - Parameter animation via API.
  - Swap, reorder and merge for clips, columns and layers.
  - Wire REST API v2 with atomic "batch operations."
  
  — [Resolume 7.26 post](https://resolume.com/blog/34484)
- 7.26 MCP servers let AI assistants "build and manage your compositions, load files, sources, add and remove effects, layers, columns, groups." The post says this is mainly for building compositions, not live performance. They require Resolume 7.26+. — [Resolume 7.26 post](https://resolume.com/blog/34484), [Resolume support: MCP Servers](https://resolume.com/support/es/mcp-servers)
- 7.27: Wire attribute parameters can be controlled via OSC, MIDI, DMX and keyboard without recompiling. — [Resolume 7.27 post](https://resolume.com/blog/34561)
- 7.28: MIDI and OSC monitors support copying messages. — [Resolume 7.28 post](https://resolume.com/blog/34630)
- 7.25: "MIDI/Keyboard mapping is also quicker." 7.24 brought faster MIDI processing. — [Resolume 7.25 post](https://resolume.com/blog/34172), [Resolume blog index](https://www.resolume.com/blog)
- SMPTE (Arena only):
  - "SMPTE Input is available on Resolume Arena only!" It is an audio LTC-style signal on a line input.
  - "Resolume Arena can listen to two SMPTE inputs simultaneously."
  - Clips are assigned to SMPTE 1/2 through the Timeline dropdown, with per-clip offset and delay compensation in frames.
  - "The clip trigger itself is not sent via SMPTE."
  - "SMPTE is not available on clips with an audio track."
  - MTC is not mentioned.
  
  — [Resolume manual: SMPTE](https://resolume.com/support/en/smpte)

**VDMX6**
- "Connects to MIDI and OSC controllers, sends and receives DMX over ArtNet, and publishes parameters with OSCQuery." It syncs via LTC and MTC. — [vidvox.net](https://vidvox.net/)
- Plugins:
  - "Timecode" (receive, generate and send LTC, MTC, OSC).
  - "OSCQuery Client" (browse and remote-control other apps' parameters).
  - "Comm Display" (MIDI/OSC monitor).
  - "HID Input" (gamepads).
  - "Wiimote".
  - "Control Surface" (custom UI layouts).
  
  — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)

**Modul8**
- "MIDI, DMX, OSC, mouse and keyboard, audio-signal control of parameters." Custom UIs via Python modules. — [garagecube.com/modul8](https://www.garagecube.com/modul8/)

**Synesthesia**
- MIDI mapping happens in a MIDI panel with 7 tabs (scene specific, global, meta controls, media, favslots, start scenes, devices). MIDI feedback output drives LEDs and motor faders. "Pickup mode" prevents value jumps. — [Synesthesia FAQ: MIDI & OSC](https://app.synesthesia.live/docs/faq/midi_osc.html)
- OSC is Pro only. Input covers controls and scenes, output exposes the audio engine, and output addresses are fixed. — [Synesthesia FAQ: MIDI & OSC](https://app.synesthesia.live/docs/faq/midi_osc.html), [Synesthesia pricing](https://synesthesia.live/pricing)
- Bindable targets: "almost any control, Fav Slot, or playlist action." — [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html)

**Smode Live**
- "Control with Midi/OSC." LTC/MTC clock inputs on every Live tier. DMX/Art-Net/sACN universes per tier: 8 / 16 / 32 / 64. — [Smode Live page](https://www.smode.io/en/product/live-media-server)
- PosiStageNet and Python are listed among open protocols. — [smode.io open protocols](https://www.smode.io/en/tech-partners/open-protocols-ndi-spout-posistagenet-python-isfshaders)

**TouchDesigner**
- Pro-tier-only items include Sync In/Out CHOPs and hardware frame-lock. — [TD docs: Products](https://docs.derivative.ca/TouchDesigner_Products), [TD Licensing](https://derivative.ca/UserGuide/Licensing)
- Community VJ systems provide MIDI/OSC mapping; SonomikaTD has "MIDI and OSC control." — [SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106)

### Inferences
- **Control matrix:**

| Capability | Resolume Avenue | Resolume Arena | VDMX6 | Modul8 | Synesthesia | Smode Live | TouchDesigner |
|---|---|---|---|---|---|---|---|
| MIDI learn + feedback | Yes (+controller presets) | Yes | Yes | Yes | Yes (feedback, pickup) | Yes | Build / community |
| OSC | Yes | Yes | Yes + OSCQuery | Yes | Pro only | Yes | Yes |
| DMX / Art-Net input | No | Yes | Yes | Yes | ? | Yes | Yes (ops; not fetched) |
| Keyboard mapping | Yes | Yes | ? | Yes | Hotkeys | ? | Build |
| Web remote / REST / WebSocket | Yes | Yes | No (OSCQuery instead) | No | No | ? | Build (Web Server DAT, not fetched) |
| AI / MCP control | Yes (7.26) | Yes | No | No | No | ? | Community MCP tools |
| SMPTE / LTC | No | Yes (2 inputs) | LTC + MTC | ? | ? | LTC + MTC | ? |

- Table stakes: MIDI learn with LED feedback and controller templates (APC40/APC Mini level), OSC in/out, keyboard shortcuts, and a MIDI/OSC monitor.
- Pro-tier differentiators: DMX input from lighting desks, LTC/MTC timecode with offsets, and a REST/WebSocket remote.
- A browser-based tool has a natural advantage here. Its whole UI is already web-addressable, so a phone/tablet remote and an HTTP/WebSocket API are cheap to offer. Resolume needed years (7.8 in 2021, 7.26 in 2026) to get this.
- OSC and DMX in a browser need a bridge: a WebSocket↔UDP relay or a companion app. Inference.
- Resolume's MCP (2026) shows vendors expect AI-assisted "build my composition" workflows. A web tool could expose the same API surface to an LLM. CDM noted mixed community reaction to the MCP release ([CDM](https://cdm.link/?p=167917)).

### Gaps
- No Launchpad preset confirmed for Resolume, and no controller presets confirmed for VDMX, Synesthesia or Modul8.
- Not verified: Synesthesia timecode, Modul8 timecode, and Resolume MTC (only audio SMPTE is documented).
- TouchDesigner's MIDI/OSC/DMX/Web Server operators were not fetched in this pass.

---

## 5. Output and recording: multi-output, Syphon/Spout/NDI out, recording, advanced output/slices, DMX/LED pixel mapping

### Takeaway
Fullscreen output across multiple displays, plus Syphon/Spout/NDI out, are standard. Resolume Arena's Advanced Output stands out among VJ tools for its slices, warping, edge blending, per-screen NDI outputs, capture-card output and DMX pixel mapping via Lumiverses and Art-Net. Smode Live is positioned as a media server with tiered I/O, from 1×FHD up to 4×4K, and DMX universes. Built-in recording exists in Resolume (DXV3 default) and VDMX (Movie Recorder). Synesthesia relies on Syphon Recorder or OBS.

### Cited Findings

**Resolume**
- Advanced Output is available in both editions, but "To get everything it has to offer, you will need Arena." Outputs include physical displays, capture cards, DMX pixel strips, and Syphon/Spout virtual outputs. — [Resolume manual: Advanced Output](https://resolume.com/support/en/advanced-output)
- NDI out: "Enabling NDI in the Output Menu starts broadcasting the main output." In Arena, "every NDI screen created in the Advanced Output will be a separate NDI Source," each with its own resolution, bit depth, colour space and alpha. "Typically a 60 FPS 1080p NDI stream will require at least 150 megabits/seconds." — [Resolume manual: NDI](https://resolume.com/support/en/NDI_inputs_and_outputs)
- Arena-only: Projection Mapping, Edge Blending, Capture Card Output, Slice Transforms and DMX Fixture Output. — [Avenue/Arena difference](https://resolume.com/support/en/avenue-arena-difference)
- 7.25 added Scale/Position in Slice Transform and double-click slice preview. 7.29 is announced with "a few new slice effects." — [7.25 post](https://resolume.com/blog/34172), [7.28 post](https://resolume.com/blog/34630)
- 7.24 (likely late 2025) added "10-bit colour output." — [Resolume blog index](https://www.resolume.com/blog)
- DMX output / pixel mapping (Arena only):
  - "Lumiverses" are virtual sets of 512-channel universes with Auto Span and Align Output.
  - A Fixture Editor lets you build custom fixtures.
  - Arena "samples the centre pixel of each square."
  - Art-Net nodes are auto-detected, with unicast recommended at about 30+ universes.
  - ArtSync and a default 40 ms delay keep LEDs in sync with projectors.
  - Enttec USB is unsupported since Arena 6.
  - The page mentions only Art-Net, not sACN or KiNET.
  
  — [Resolume manual: DMX Output](https://resolume.com/support/en/dmx)
- Recording: by default "Quicktime, with the DXV3 codec at normal quality." Audio is recorded as uncompressed WAV. "After Recording" can place the movie onto an empty clip. The page covers v6–7.17. — [Resolume manual: Recording](https://resolume.com/support/en/recording)

**VDMX6**
- "Displays output fullscreen across one or more monitors." It outputs individual layers via Syphon, sends and receives NDI, and records audio/video to disk. — [vidvox.net](https://vidvox.net/)
- Output plugins: NDI Output, Syphon Output, Blackmagic Output (with keying), Movie Recorder (QuickTime), and Video To DMX ("converts video into DMX values over Artnet for LED displays"). — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- 6.2 (Aug 2025) brought an improved fullscreen output panel. — [VDMX 6.2](https://vdmx.vidvox.net/blog/vdmx-6-2-update)
- VDMX6 Blackmagic improvements: full duplex, audio out and alpha key. — [VDMX6 launch](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337)

**Modul8**
- Syphon to MadMapper is the intended mapping path (GarageCube's separate product). — [garagecube.com/modul8](https://www.garagecube.com/modul8/)
- Multiple screen output on MacPro (older). — [Wikipedia](https://en.wikipedia.org/wiki/Modul8)

**Synesthesia**
- Output resolution: Standard is limited to 1080p, and Pro runs "at any resolution or aspect ratio." There is a fullscreen pop-out visualizer on any display. — [Synesthesia FAQ: Video](https://app.synesthesia.live/docs/faq/video.html)
- Syphon/Spout output is available. The pricing page lists Syphon/Spout/NDI as Pro features, while the FAQ attaches the Pro requirement only to NDI. The two pages disagree. — [Synesthesia FAQ: Video](https://app.synesthesia.live/docs/faq/video.html); contradicted by [Synesthesia pricing](https://synesthesia.live/pricing)
- No built-in recorder. On macOS use Syphon Recorder. On Windows, "There is no equivalent 'Spout Recorder'," so use OBS. — [Synesthesia FAQ: Video](https://app.synesthesia.live/docs/faq/video.html)

**Smode Live**
- Tiers:

  | Tier | Video I/O | DMX universes |
  |---|---|---|
  | LIVE BASIC | 1×FHD | 8 |
  | LIVE 1 | 1×4K or 4×FHD | 16 |
  | LIVE 2 | 2×4K or 8×FHD | 32 |
  | LIVE 4 | 4×4K or 16×FHD | 64 |

- Content resolution is unlimited on Live tiers. Video export is capped at 4K on BASIC and unlimited on the others. — [Smode Live page](https://www.smode.io/en/product/live-media-server)
- The "Deliver" module covers "video mapping and real-time show control." — [smode.io](https://www.smode.io/en)

**TouchDesigner**
- Commercial and above unlock "realtime H.264/H.265 encoding and RTSP/RTMP/SRT streaming" (NVIDIA required). Pro adds Vioso/Scalable Display calibration and hardware frame-lock. Non-Commercial is limited to 1280×1280. — [TD docs: Products](https://docs.derivative.ca/TouchDesigner_Products), [TD Licensing](https://derivative.ca/UserGuide/Licensing)
- SonomikaTD has "Built in video recording" and "Screenshot capture." — [SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106)

### Inferences
- **Output matrix:**

| Capability | Resolume Avenue | Resolume Arena | VDMX6 | Modul8 | Synesthesia | Smode Live | TouchDesigner |
|---|---|---|---|---|---|---|---|
| Multi-display fullscreen | Yes | Yes | Yes | Yes (older) | Pop-out window | Tiered I/O | Yes |
| Syphon/Spout out | Yes | Yes | Syphon | Syphon | Yes (Pro per pricing) | Spout | ? (not fetched) |
| NDI out | Yes (main) | Yes (per screen) | Yes | Yes (2018) | Pro | Yes | ? (not fetched) |
| Capture-card / SDI out | No | Yes | Blackmagic | ? | ? | Yes (I/O) | ? |
| Slices / warp / edge blend | Partial | Full | Perspective per layer | via MadMapper | No | Yes (mapping) | Build |
| DMX / LED pixel mapping | No | Yes (Lumiverses) | Video To DMX | ? | No | 8–64 universes | Build (DMX Out) |
| Built-in recording | Yes (DXV3) | Yes | Yes | ? | No | Batch export | Yes (Movie File Out; H.264 needs Commercial) |
| 10-bit output | Yes (7.24) | Yes | ? | ? | ? | ? | Yes (implied by 16-bit decode) |

- Table stakes: multi-display fullscreen output, a virtual video out (Syphon/Spout/NDI), and recording the master output.
- Differentiators: per-screen NDI/slice routing, capture-card output, DMX pixel mapping for LED fixtures, and edge blending. These are exactly the features Resolume reserves for Arena (€799 vs €299 for Avenue), so the market treats them as the premium tier.
- For a browser tool (inference): the Window Management API (multi-screen placement), multiple popup windows/OffscreenCanvas, and MediaRecorder for output recording are the web equivalents. NDI/Syphon/Spout and Art-Net would require a native helper. That makes them natural candidates for a paid "pro" tier, mirroring Resolume's Avenue/Arena split.

### Gaps
- No primary source confirmed which Advanced Output sub-features (slices, masks, input selection) Avenue gets versus Arena beyond "Slice Transforms" and "Edge Blending" being Arena-only.
- sACN/KiNET support in Resolume DMX output was not confirmed.
- Modul8 v3 output and recording capabilities were not confirmed.

---

## 6. Reliability and workflow: presets/dashboards, crash recovery, autosave, performance monitoring, file management, show lock

### Takeaway
Reliability features are uneven, which is an opportunity:
- **Media management**: Resolume's Media Manager (missing-file relocate with sibling search, "Fix All", "Collect Media") is the strongest documented example.
- **Presets/dashboards**: universal. Examples are Resolume Dashboard, VDMX Plugin Templates and Control Surfaces, and Synesthesia presets, FavSlots and playlists.
- **Autosave/crash recovery**: no documented autosave in Resolume. Users have requested it repeatedly in the forum.
- **Show-mode lock**: rarely documented.

### Cited Findings

**Resolume**
- Media Manager:
  - Missing clips "marked in red and have a 'Relocate' button."
  - Resolume then searches for "sibling files" in the same relative positions, and "Fix All" relinks every match.
  - Changes apply on close, but "it does not save your composition!"
  - "Collect Media" copies all media into a Media folder per deck and saves a relinked composition copy. "The Media Manager always copies! Resolume will never try to delete files."
  - Output settings, fixtures, custom effects and presets are not collected yet.
  
  — [Resolume manual: Media Manager](https://resolume.com/support/en/media-manager)
- No autosave or crash-recovery feature is documented on the Media Manager page or found in the manual index. — [Resolume manual: Media Manager](https://resolume.com/support/en/media-manager), [Resolume manual index](https://resolume.com/support/en/7)
- Forum threads (2021 and 2023) request autosave or auto-backup with configurable intervals. Users found the lack of autosave in a program that can crash "ridiculous." — [Resolume forum thread](https://resolume.com/forum/viewtopic.php?p=78333), [Resolume forum thread](https://www.resolume.com/forum/viewtopic.php?p=65696) (found via search; the mapping of individual quotes to threads is not verified)
- Crash handling in older versions: staff ask users to send log files, and suggest moving config.xml to reset to defaults (Arena 5 era). — [Resolume forum](https://resolume.com/forum/viewtopic.php?p=57009) (older)
- Performance:
  - 7.24 (likely late 2025): faster composition loading. A beta tester's file went from 8 min to 1 min. — [search summary of Resolume blog](https://www.resolume.com/blog)
  - 7.25: "loading is faster" on large compositions. — [7.25 post](https://resolume.com/blog/34172)
- 7.20 added "Hardware & Node Stats" in Wire, i.e. performance monitoring. — [Resolume 7.20 forum announcement](https://resolume.com/forum/viewtopic.php?p=94957) (title only seen via search)
- Several 7.28 fixes address crashes, e.g. "moving a point in a polygon slice," "making a snapshot with no empty clip slots," and "entering a non-existent IP in the OSC Outgoing Address." — [Resolume 7.28 post](https://resolume.com/blog/34630)
- Preset systems:
  - Dashboard dials link multiple parameters. — [Dashboard](https://resolume.com/support/en/dashboard)
  - Animation presets save the loop mode. — [Parameter Animation](https://resolume.com/support/en/parameter-animation)
  - MIDI shortcut presets are XML files. — [MIDI Shortcuts](https://resolume.com/support/en/midi-shortcuts)

**VDMX6**
- 6.3 (July 2026): "Plugin Templates," managed via Workspace Inspector, Templates Manager or Finder. A "System Permissions Status" pane shows each macOS permission VDMX uses, a reliability aid on modern macOS. — [VDMX 6.3](https://vdmx.vidvox.net/blog/announcing-vdmx-63)
- Manual sections cover "Saving projects and assets" (`/vdmx/vdmx_saving`, `/vdmx/vdmx_assets`) and multiple GPUs. — [VDMX docs index](https://docs.vidvox.net/vdmx/)
- Section presets exist inside the Clock, Control Surface, Cue List and LFO plugins. — [VDMX docs: Plugins](https://docs.vidvox.net/vdmx/vdmx_plugins)
- "VDMX and macOS 26!" (Sept 15, 2025) gives OS-update guidance, a recurring risk area for Mac-only tools. — [VDMX blog](https://vdmx.vidvox.net/blog/vdmx-and-macos-26)

**Synesthesia**
- Presets have Scene, Meta and Media channels that can be toggled. Each control bank has its own lock, undo, default and randomize. — [Docs: Presets](https://app.synesthesia.live/docs/manual/presets.html), [Docs: Controls](https://app.synesthesia.live/docs/manual/controls.html)
- A user report describes crashes when running Synesthesia alongside VirtualDJ stem separation: "crashed twice then crashed AND locked access to VDJ." Frame rate dropped "from between 60-150fps to 15-20fps." — [VirtualDJ forum](https://virtualdj.com/forums/257131/General_Discussion/VDJ_%28with_stems%29_%2F_Synesthesia_%2F_Spout_issues....html)

**Smode**
- Hardware:
  - Windows 10+ and a GPU with 8 GB or more.
  - NVIDIA RTX recommended. "AMD support was later downgraded to experimental." "Intel, Matrox or other GPU are not supported."
  - SLI must be disabled.
  - NVMe directly attached to the CPU is recommended.
  - Virtual machines are not supported.
  
  — [Smode FAQ](https://www.smode.io/en/faq)

### Inferences
- Table stakes: save/load of whole sets, presets at parameter/effect/layer level, a macro dashboard, and missing-media relinking.
- Under-served: autosave with versioned backups, crash recovery that restores the last state, a "show mode" or UI lock, and a performance HUD showing GPU/CPU/decoder load and dropped frames. None were documented by the major VJ tools in this research, and Resolume users explicitly ask for autosave.
- A browser tool can cheaply offer continuous autosave to IndexedDB or the cloud, version history, and "resume after tab crash." That would be a real differentiator against Resolume.
- Media portability is a known pain. Resolume's "Collect Media" excludes output settings, fixtures and presets. A single-file or cloud project bundle would be valuable.

### Gaps
- No documentation found on: autosave or crash recovery in VDMX, Synesthesia, Modul8, Smode or TouchDesigner (TD has "Backup" .toe incremental saves per general knowledge, not verified here); performance monitoring panels outside Resolume Wire stats; or a show-mode lock in any product.

---

## 7. Pricing, licensing (EUR/USD, perpetual vs subscription, demo limits) and target audience

### Takeaway
The VJ market is dominated by perpetual licenses with optional paid update years, not subscriptions. Free or unlimited demos are the norm, with a watermark on output; Modul8 and VDMX also block saving.

| Product | Price (Oct 2026) | Licensing model | Demo / free tier |
|---|---|---|---|
| Resolume Avenue | €299 | Perpetual + 12 months of updates, renewable; "not a subscription" | Logo watermark + robot voice on audio |
| Resolume Arena | €799 | Same as Avenue | Same as Avenue |
| Resolume Wire | €399 | Same as Avenue | Same as Avenue |
| VDMX6 / VDMX6 Plus | $199 / $349 (launched at $99 / $249 in Sept 2024) | ? | Fully functional except saving |
| Modul8 v3 | €299 for 2 computers | ? | Watermark, no saving, no module library |
| Synesthesia Standard / Pro | $199 / $399 | Perpetual, 1 year of updates then $60/year | Unlimited trial with watermark |
| Smode | "Contact us" | Dongle-based tiers; perpetual on request | Free Community edition: FHD, no watermark, non-commercial |
| TouchDesigner | Free / $300 / $600 / $2200 (Non-Commercial / Educational / Commercial / Pro) | ? | Non-Commercial capped at 1280×1280, no paid work |

### Cited Findings

**Resolume**
- Avenue €299.00, Arena €799.00, Wire €399.00. USD is not shown. — [Resolume Shop](https://resolume.com/shop)
- 50% off for students, teachers and institutions. — [Resolume Shop](https://resolume.com/shop)
- Purchases include free updates for 12 months, then you can renew. "Your last eligible update will always continue working." — [Resolume Shop](https://resolume.com/shop)
- Renewal is "not a subscription." A watermark returns only if you install an update released after your expiry. Hotfixes continue after expiry, from 7.13.2 on. You can renew up to 100 days early. — [Resolume: Yearly Renewals](https://resolume.com/article/88)
- Demo: "trial the software for as long as you like," but output carries a Resolume logo watermark and audio includes "a robot voice." — [Resolume Shop](https://resolume.com/shop)
- Avenue→Arena upgrade: pay the difference. "Avenue … everything you need for a VJ show on a projector or LED wall." Arena targets mapping, blending, lighting-desk and DJ-sync shows. — [Avenue/Arena difference](https://resolume.com/support/en/avenue-arena-difference), [resolume.com/software](https://resolume.com/software)
- A third-party comparison lists Arena at "about $1100." This conflicts with the €799 shop price and is likely outdated or VAT/currency-inflated. — [SaaSHub VDMX vs Resolume](https://www.saashub.com/compare-vdmx-vs-resolume); contradicted by [Resolume Shop](https://resolume.com/shop)
- Resolume ran a "User Survey 2026" asking for feature requests. — [Resolume blog](https://resolume.com/blog/33196)

**VDMX6**
- Current: "199 USD for VDMX6 and 349 USD for VDMX6 Plus. Educational, hobbyist, and upgrade discounts are available." The demo is "Fully functional except for the ability to save projects." macOS only, and the demo requires macOS 13+. — [vidvox.net](https://vidvox.net/)
- At launch (Sept 12, 2024): VDMX6 $99, VDMX6 Plus $249. VDMX5 buyers after Sept 12, 2023 got a free VDMX6 Plus. Others got $100 off. — [VDMX6 launch post](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337). Prices appear to have roughly doubled since launch, per [vidvox.net](https://vidvox.net/).
- A Pi Day sale ran March 14–21, 2026. — [VDMX blog](https://vdmx.vidvox.net/blog/pi-day-week-long-sale-2026)

**Modul8 v3**
- Standard license: 2 computers €299, 5 computers €710, 10 computers €1,405 (excl. tax). Educational: 2 computers €199, up to 20 computers €1,850. — [GarageCube shop](https://m8shop.garagecube.com/)
- Demo: "You cannot access the online module library," "You cannot save a project," "There is a watermark in the output." — [GarageCube shop](https://m8shop.garagecube.com/)
- macOS 10.9.5 up to macOS Tahoe 26. Apple Silicon is supported only by "requiring the installation of Rosetta." — [garagecube.com/modul8](https://www.garagecube.com/modul8/)

**Synesthesia**
- Free trial: "Unlimited Trial Period," "Video output is marked with our logo," no sign-up.
- Standard $199: one-time, "A Synesthesia license never expires." Includes 1 active device and MIDI. Excludes Syphon/Spout/NDI and OSC.
- Pro $399: Syphon/Spout/NDI, OSC in/out, 2 active devices.
- Updates: 1 year included, then $60/year, though "updates are currently free because restrictions aren't being enforced."
- Upgrade from Standard to Pro costs the difference. Discounts are available for students, educators and non-profits.

— [Synesthesia pricing](https://synesthesia.live/pricing)
- Resolution: Standard is limited to 1080p, Pro is unlimited. — [Synesthesia FAQ: Video](https://app.synesthesia.live/docs/faq/video.html)
- Audience: "DJs, VJs, streamers, coders, artists." — [synesthesia.live](https://synesthesia.live/)

**Smode**
- Editions:
  - Community (free): "no ads, no user data tracking," "fully usable without watermarks" up to Full HD, non-commercial.
  - Compose: offline creation.
  - Live: media server, tiers BASIC/1/2/4.
  - Live XR and Media Server.
  
  — [smode.io](https://www.smode.io/en), [Smode Live page](https://www.smode.io/en/product/live-media-server)
- No public prices: Live tiers show "Contact us." Licenses sit on Wibu CodeMeter dongles (Compose can also be machine-locked). "Perpetual licenses are available on request." — [Smode Live page](https://www.smode.io/en/product/live-media-server), [Smode FAQ](https://www.smode.io/en/faq)
- A third-party directory claims subscriptions of "$100 to $800 per month." This is unverified. — [AlternativeTo](https://alternativeto.net/software/smode-studio/about)
- Audience: content creators, VJs/video operators, integrators, rental companies and broadcasters. Scale claims: "16 Years," "+500 Projects," "9000 Users." — [smode.io](https://www.smode.io/en)

**TouchDesigner**
- Prices:

  | License | Price | Floating |
  |---|---|---|
  | Non-Commercial | Free | — |
  | Educational | $300 | $450 |
  | Commercial | $600 | $900 |
  | Pro | $2200 | $3300 |

  TouchPlayer costs $300 (Commercial) or $800 (Pro).
- Non-Commercial is for "personal, educational or evaluation purposes … You may not use TouchDesigner Non-Commercial for any paid work." It is capped at 1280×1280.

— [TD Licensing](https://derivative.ca/UserGuide/Licensing), [TD Products](https://docs.derivative.ca/TouchDesigner_Products)
- Pro includes 6 hours of Pro Support. Commercial keys can move between computers. — [TD Products](https://docs.derivative.ca/TouchDesigner_Products)
- Current build: 2025.33230 (Sept 1, 2026), per a search summary of the release notes. Cached copies showed different "current" builds. — [TD Release Notes](https://docs.derivative.ca/Release_Notes) (conflicting snapshots)
- VDMX6 Plus can host TD compositions only with a paid TD license. — [VDMX6 launch](https://discourse.vidvox.net/t/introducing-vdmx6-and-vdmx6-plus/2337)

### Inferences
- Price bands:
  - Entry VJ tool: about €200–300 / $200 (Avenue, VDMX6, Synesthesia Standard, Modul8).
  - Pro VJ with mapping, DMX and timecode: about €400–800 (Arena, VDMX6 Plus, Synesthesia Pro).
  - Media-server class: quote-based (Smode Live) or $2200+ (TD Pro).
- The dominant licensing pattern is a perpetual license plus 12 months of updates with optional renewal (Resolume, Synesthesia). The market appears to resist pure subscriptions; Resolume explicitly says "This is not a subscription!"
- A browser tool with a subscription model should expect this resistance. A "keep last version / offline mode" guarantee could defuse it (inference).
- Demo patterns: an unlimited trial with a watermark is the norm (Resolume, Synesthesia, Modul8). Blocking save (VDMX, Modul8) is a stronger gate. Resolution caps (TD 1280×1280, Synesthesia Standard 1080p, Smode Community FHD) are another lever.
- A browser freemium tier could use watermark + resolution caps, gating NDI/OSC/DMX/timecode and multi-output as "Pro," which mirrors Synesthesia and Resolume.
- Platform: VDMX and Modul8 are macOS-only, and Modul8 is not even Apple-Silicon native. Smode is Windows/NVIDIA-only. Resolume, Synesthesia and TD are cross-platform. A browser tool is inherently cross-platform, which is a positioning advantage.

### Gaps
- Resolume USD prices and renewal prices are not shown publicly; renewal prices sit behind the account login.
- Smode list prices are not public.
- Modul8 has no USD price and no upgrade terms.
- TouchDesigner update and renewal terms (how long a key covers new builds) were not found on the fetched pages.
- VDMX current exact version: vidvox.net download links reference "1.3.8," which conflicts with the blog's VDMX 6.3 (July 2026), possibly an artefact of the page. Not resolved.

---

## 8. What users praise and complain about (forums, r/vjing, reviews)

### Takeaway
- **Resolume** is called the "industry standard" and beginner-friendly for clip-based VJing. Complaints focus on price, the Avenue/Arena feature split, missing autosave, and the 2026 AI/MCP direction, which drew mixed reactions.
- **VDMX** is praised for its modular, customisable interface and hardware integration, but it is Mac-only and has a steep learning curve.
- **Synesthesia** is "the fastest path" to audio-reactive shows, but it is a specialist tool that is weak for clip mixing or mapping.
- **TouchDesigner** is far more powerful and in commercial demand, with a much steeper learning curve.
- **Modul8** appears stagnant: Rosetta-only on Apple Silicon and no visible major release since 3.0 (2018).

Reliable, recent first-hand user data is sparse. Reddit pages could not be fetched directly, so the community quotes below come via search snippets.

### Cited Findings
- **Resolume, praise:**
  - r/vjing commenters call it the "industry standard for VJing," "beginner friendly and gets you going fast but expensive." — [r/vjing "Getting into VJing" (Jul 27, 2024, via redlib mirror)](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing) (snippet via search; mirror unreachable on direct fetch)
  - Arena is noted for "advanced mapping needed for video walls at festivals, Avenue is cheaper and has less features." — [SaaSHub VDMX vs Resolume](https://www.saashub.com/compare-vdmx-vs-resolume) (aggregator)
- **Resolume, complaints:**
  - Lack of autosave. — forum threads [p=78333](https://resolume.com/forum/viewtopic.php?p=78333), [p=65696](https://www.resolume.com/forum/viewtopic.php?p=65696) (2021/2023 feature requests; quote mapping unverified)
  - Piano mode and Autopilot interaction. — [forum p=40466](https://resolume.com/forum/viewtopic.php?p=40466)
  - Link implementation can't push resync or pause. — [forum p=84352](https://resolume.com/forum/viewtopic.php?p=84352)
  - Older review (Arena 4 era): interface "lacks some professional polish," codec support could be broader, and the "inability to run in a cued environment limits its standalone use." — [Equipboard: Resolume Arena 4](https://equipboard.com/items/resolume-arena-4) (older, approx. 2012; attribution via search summary)
  - AI direction: CDM notes that 7.26's MCP "drew mixed reactions from the community." The author argues AI tools depend on subscriptions and credits rather than being owned outright. — [CDM, Sept 25, 2026](https://cdm.link/?p=167917)
- **VDMX:** "I prefer the interface which is extremely mod[ular]," and it is Mac-only. — [r/vjing via redlib](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing). An aggregator lists a "high learning curve" and strong hardware-controller integration. — [SaaSHub](https://www.saashub.com/compare-vdmx-vs-resolume)
- **Synesthesia:**
  - "the fastest path from zero to an amazing visual show," but "Limited if your goal is to mix your own video clips or do complex projection mapping. It's a specialist tool." — [eathealthy365 "A Review of the Top Live VJ Software"](https://eathealthy365.com/a-review-of-the-top-live-vj-software/) (low-credibility domain; treat as anecdotal)
  - A Reddit user says the devs "tuned performance to less than great laptop mics" and that it "does amazing FFT analysis that is sent out as OSC." — via search snippet linking [redlib user page](https://redlib.hbubli.cc/u/allhellbreaksloops) (anecdotal)
  - Stability issues when co-running with VirtualDJ stems. — [VirtualDJ forum](https://virtualdj.com/forums/257131/General_Discussion/VDJ_%28with_stems%29_%2F_Synesthesia_%2F_Spout_issues....html)
- **TouchDesigner:**
  - Forum users rate it "a much steeper climb than Resolume," "far more powerful but not suited to most people." — [Resolume forum p=41268](https://resolume.com/forum/viewtopic.php?p=41268) (older)
  - r/vjing: Resolume is quick to get going, while TD takes long to learn. — [r/vjing via redlib](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing)
  - The community is building its own Resolume-like VJ shells (SonomikaTD, okVJ, the 5-layer system), which signals demand for VJ-style UIs on top of TD's engine. — [SonomikaTD](https://derivative.ca/community-post/asset/sonomikatd-touchdesigner-vj-system/75106), [Montréal meetup](https://derivative.ca/community-post/asset/touchdesigner-meetup-montr%C3%A9al-%E2%80%94-highlights-resources-oct-19-2025/73213), [5-layer VJ system](https://derivative.ca/community-post/asset/release-versatile-vj-system-5-layer-control-custom-ui/73834)
- **Modul8:**
  - Requires Rosetta on Apple Silicon. — [garagecube.com/modul8](https://www.garagecube.com/modul8/)
  - The last documented major release is 3.0 (RC1, June 2018). — [Softpedia changelog](https://mac.softpedia.com/progChangelog/Modul8-Changelog-8394.html) (via search snippet)
  - Wikipedia still lists 2.7.2 (Jan 2014) as the latest stable release, an outdated entry. — [Wikipedia](https://en.wikipedia.org/wiki/Modul8)
- **General advice:**
  - Common r/vjing advice is "you really REALLY need a midi controller for VJing." — [r/vjing via redlib](https://redlib.ssps.io/r/vjing/comments/1edrtmp/getting_into_vjing)
  - Resolume is described as "built for performing with video you've already prepared," with media management overhead. — summary of [Interactive & Immersive HQ: Resolume vs TouchDesigner](https://interactiveimmersive.io/blog/technology/resolume-vs-touchdesigner/) (only the title was retrievable on direct fetch; the claim comes from a search summary)

### Inferences
- **Table stakes vs differentiators (overall synthesis for a browser-based mapping/VJ tool):**
  - **Table stakes (missing = not taken seriously):**
    - A layer stack with blend modes and opacity.
    - A clip/scene launcher grid with column triggers.
    - Beat-quantised launch and BPM tap.
    - An A/B crossfader.
    - Autopilot or follow actions.
    - LFO, envelope and BPM-synced parameter animation.
    - FFT audio reactivity (L/M/H bands with gain/decay).
    - MIDI learn with LED feedback, plus at least APC40/APC Mini templates.
    - OSC and keyboard mapping.
    - About 50–100 GPU effects and generators.
    - Webcam/capture input.
    - Performant playback of pre-rendered clips (the HAP/DXV class).
    - Fullscreen multi-display output.
    - Output recording.
    - Presets and a macro dashboard.
    - Missing-media relinking.
  - **Strong differentiators (2026):**
    - Shader interoperability (ISF import).
    - A web remote and REST/WebSocket API (Resolume has this; others don't).
    - AI-assisted composition building (Resolume MCP, 2026).
    - Computer-vision effects (segmentation, depth, body tracking).
    - Music-structure-aware automation (Synesthesia's drop/breakdown Auto-Transition, `syn_Intensity`).
    - Ableton Link plus DJ-hardware sync.
    - Timecode (LTC/MTC) with cue lists.
    - DMX in plus Art-Net pixel mapping.
    - Per-screen NDI and slice routing.
    - Autosave and crash recovery, which nobody documents well.
    - True cross-platform reach (VDMX/Modul8 are Mac-only, Smode is Windows/NVIDIA-only).
- User pain points a browser tool could target:
  - Price and tier gating: Resolume's €299 vs €799 split around mapping.
  - Platform lock-in.
  - No autosave.
  - Steep learning curves (TD, VDMX).
  - Specialist limits: Synesthesia lacks clip mixing and mapping.
- Credibility risk for a browser tool: performance with many HD/4K layers. Pro users judge tools by multi-layer HAP/DXV playback stability. Clear benchmarks and a codec strategy are essential (inference).

### Gaps
- Direct Reddit threads (r/vjing) could not be fetched. Quotes come only via search snippets of mirror sites. There is no quantitative sentiment data, such as survey results; Resolume's 2026 user survey results were not found published.
- No recent (2025–26) independent long-form reviews of VDMX6, Synesthesia, Smode or Modul8 were found.
- User sentiment on Smode for VJ use (versus its media-server use) was not found.
