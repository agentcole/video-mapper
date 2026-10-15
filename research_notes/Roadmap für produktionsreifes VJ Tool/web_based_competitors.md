# Browser-based and web-technology VJ / projection-mapping tools: the competitive set (state as of 15 Oct 2026)

Method note: GitHub stars, last-push dates, release dates and licenses were pulled from the GitHub REST API on 2026-10-15 and are cited to the repo URL. Reddit was blocked for both the search and fetch tools, so there is no direct Reddit evidence (see Gaps under Q5). "Last push" means the last commit on any branch. It is not the same as a tagged release.

---

## Q1. Which browser and web-tech tools exist for live visuals and projection mapping?

### Takeaway
The web-tech field is large but fragmented. It has (a) live-coding synths such as Hydra and Punctual, (b) general visual patchers such as cables.gl and Nodes, (c) MilkDrop-style visualizers such as Butterchurn, Stims and Kaleidosync, (d) Electron VJ hosts such as modV, Hedron and Ghost Arcade, and (e) a long tail of small browser projection mappers such as 4mapper, OpenVJ and ProjectorVideoMappingWeb. Most of the tail was created in 2025–2026 and has fewer than 20 stars. No established, production-grade VJ plus mapping tool runs in a plain browser tab.

### Cited Findings

**A. Live-coding visual synths (browser-native)**
- **Hydra**: "Livecoding networked visuals in the browser". 2,729 stars, AGPL-3.0, last push 2026-04-25. The old ojack/hydra repo (279 stars) was last pushed 2022-10-27, and development moved to the hydra-synth org — [GitHub hydra-synth/hydra](https://github.com/hydra-synth/hydra); [GitHub ojack/hydra](https://github.com/ojack/hydra)
- The Hydra engine is published separately as `hydra-synth` (400 stars, last push 2026-07-16), with `rtc-patch-bay` for networking and `atom-hydra` for the Atom editor — [GitHub hydra-synth/hydra README](https://github.com/hydra-synth/hydra); [GitHub hydra-synth/hydra-synth](https://github.com/hydra-synth/hydra-synth)
- Hydra was shown on HN in Feb 2019 (60 points) — [HN 19246447](https://news.ycombinator.com/item?id=19246447). It is "inspired by analog video synths" and uses WebRTC and WebGL so that each connected browser can send and receive streams — [CDM: Hydra / Olivia Jack](https://cdm.link/hydra-olivia-jack/)
- Hydra runs a community grants program. The page lists 2022 recipients, for example for tutorials — [hydra.ojack.xyz grants 2022](https://hydra.ojack.xyz/grants/recipients-2022)
- **Punctual**: "browser-based, zero-installation, audio-visual live coding language". 101 stars, GPL-3.0, last push 2026-09-01 — [GitHub dktr0/Punctual](https://github.com/dktr0/Punctual)
- **Estuary**: "Platform for collaboration and learning through live coding". 194 stars, GPL-3.0, last push 2026-07-07 — [GitHub dktr0/estuary](https://github.com/dktr0/estuary)
- **Flok**: "Web-based P2P collaborative editor for live coding sounds and images". 374 stars. The GitHub repo is **archived** (last push 2025-06-18) — [GitHub munshkr/flok](https://github.com/munshkr/flok)
- **Strudel**, a related audio live-coding tool, has its GitHub repo archived with the note "MOVED TO CODEBERG" (3,037 stars, last push 2025-06-19) — [GitHub tidalcycles/strudel](https://github.com/tidalcycles/strudel)
- **VEDA**: "VJ / Live Coding on Atom". 530 stars, MIT, last push **2022-09-03**, so effectively abandoned — [GitHub fand/veda](https://github.com/fand/veda). Its host editor Atom was sunset by GitHub in Dec 2022 — [GitHub blog: Sunsetting Atom](https://github.blog/2022-06-08-sunsetting-atom/)
- **LiveCodeLab**: "a web based livecoding environment". 345 stars, last push **2022-12-30**, inactive — [GitHub davidedc/livecodelab](https://github.com/davidedc/livecodelab)
- **ACID** (Algorithms Create Image Data): live-coding environment for visuals. 43 stars, last push 2025-07-09 — [GitHub adult-video/acid-app](https://github.com/adult-video/acid-app)

**B. Visual patchers and creative-coding environments**
- **cables.gl**: browser-based visual and sound patcher with an open-source Electron "standalone". The standalone "packages the editor, core, and operators" for offline work — [cables docs: What is Cables Standalone?](https://cables.gl/docs/6_2_standalone/0_general/general)
- The cables download page listed v0.7.0 (July 7, 2025), free and MIT — [cables.gl downloads](https://cables.gl/downloads). The main repo is very active (cables-gl/cables, 568 stars, last push 2026-10-15). The dev environment repo is cables_dev (MIT, 101 stars, last push 2026-10-15) — [GitHub cables-gl/cables](https://github.com/cables-gl/cables); [GitHub cables-gl/cables_dev](https://github.com/cables-gl/cables_dev)
- **Nodes** (nodes.io, by Variable.io Ltd.): JS node-based "thinking space for exploring ideas with code". Desktop downloads for Win/macOS/Linux plus a web Playground. The latest tag is v1.0.0-beta.3 (Feb 23, 2024). It targets creative developers, 3D artists and agencies, not VJs specifically — [nodes.io](https://nodes.io)
- **Meemoo**: "Creative apps to use, build, share, and hack in the browser". 273 stars, last push 2024-12-26 — [GitHub meemoo/meemooapp](https://github.com/meemoo/meemooapp)
- **p5.js** (24,128 stars) and **three.js** (116,442 stars) are both very active (last push 2026-10-15). Most hobby browser-VJ projects below are built on them — [GitHub processing/p5.js](https://github.com/processing/p5.js); [GitHub mrdoob/three.js](https://github.com/mrdoob/three.js)

**C. MilkDrop and music visualizers (web)**
- **Butterchurn**: "a WebGL implementation of the Milkdrop Visualizer". 1,968 stars, MIT, last push 2026-04-20. It requires WebGL 2 and ships presets via a separate `butterchurn-presets` npm package — [GitHub jberg/butterchurn](https://github.com/jberg/butterchurn)
- Butterchurn is embedded in **Webamp** (Winamp 2 in the browser; 11,297 stars, active 2026-10-15) and in a Chrome extension, mStream, Karaoke Forever and Syqel — [GitHub jberg/butterchurn](https://github.com/jberg/butterchurn); [GitHub captbaritone/webamp](https://github.com/captbaritone/webamp)
- **projectM** (the native reference MilkDrop library): 4,533 stars, LGPL-2.1, v4.1.8 released 2026-10-06 — [GitHub projectM-visualizer/projectm](https://github.com/projectM-visualizer/projectm)
- **Stims** (toil.fyi): "Play and live-edit MilkDrop presets in your browser". It plays original `.milk` files with no conversion, has a 1,787-preset catalog, renders on WebGL2 and WebGPU, and uses the URL as the shareable session. 12 stars, active 2026-10-15 — [GitHub zz-plant/stims](https://github.com/zz-plant/stims)
- **SilkDrop**: "MilkDrop port for web with live editor" (Show HN, 2026-07-27) — [HN 49075235](https://news.ycombinator.com/item?id=49075235). **Pasteur**: "a Milkdrop Visualization Exporter" (Show HN, 2026-04-09) — [HN 47698459](https://news.ycombinator.com/item?id=47698459)
- **Kaleidosync**: "A WebGL Spotify visualizer made with Vue, D3, and Three.js". 874 stars, last push 2025-07-15. Its v10 changelog moves to realtime in-browser audio analysis and multiple sources (Spotify, Audius, Radio Paradise, KEXP), and says "ShaderToy interoperability" is coming — [GitHub zachwinter/kaleidosync](https://github.com/zachwinter/kaleidosync)

**D. Electron / web-tech desktop VJ hosts**
- **modV**: "modular audio visualisation environment built upon web technologies". Electron + Vue + WebGL. GitHub topics include `isf`, `ndi`, `web-audio`. 494 stars. Latest release 3.30.0 (2024-08-02), last push 2026-02-17 — [GitHub vcync/modV](https://github.com/vcync/modV)
- **Hedron**: "Perform live shows with your three.js creations". Electron app with audio, MIDI and BPM LFO control, MIDI Learn, MIDI clock, scene crossfading, post-processing, and output to an external display. It is "back in development". v0.6.0 dates from 2020-03-03, v1.0.0-alpha.2 from 2025-08-21, and the last push was 2026-10-15. 516 stars — [GitHub nudibranchrecords/hedron](https://github.com/nudibranchrecords/hedron)
- **Ghost Arcade**: "Open-source projection mapping, VJ, and shader playground for live performance. Built on Svelte 5, Three.js, and Electron". Open-core: the free Community edition has quad and mesh warp, multi-output slicing, many layer types, 50+ effects, WebMIDI with MIDI Learn, a mobile companion over LAN, MP4/WebM recording, an ISF v2 playground, and audio FFT. The Pro edition adds Spout/Syphon, AI shader generation, dual-deck crossfader, snapshots, macros, setlists, keyframes and plugins. Only 11 stars; created 2026-05-03, last push 2026-05-14 — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community); site [ghostarcade.live](https://ghostarcade.live). An earlier archive repo describes it as "WebGPU-accelerated, MIDI control, mobile companion" — [GitHub riskcapital/ghost-arcade-v0-archive](https://github.com/riskcapital/ghost-arcade-v0-archive)
- **PhysMap**: "A free desktop projection-mapping workspace for macOS, Windows, and Linux". Black fullscreen projector window plus editor window. Alpha, unsigned builds; 3 stars; 2026-06 — [GitHub mirauta-alexandru/PhysMap](https://github.com/mirauta-alexandru/PhysMap)
- **Prism Mapper**: "Free, open-source offline projection mapping for Windows, Mac, Android, iPhone and iPad" (TypeScript), last push 2026-10-05 — [GitHub LoneForgeTechnologies/prism-mapper](https://github.com/LoneForgeTechnologies/prism-mapper)

**E. Browser projection-mapping apps and libraries**
- **4mapper**: commercial browser-based projection mapping for VJs and artists, positioned against MadMapper and Resolume. Features: corner-point perspective correction, multi-scene, MP4/WebM/GIF, cloud storage. Built with HTML5/JS and Stripe. Launched on Product Hunt in 2026 with 1 upvote. The maker lists ESP32 remote, timeline and advanced effects as future work — [Product Hunt: 4mapper](https://www.producthunt.com/products/4mapper-web-based-projection-mapping). Runs in Chrome or Edge on Win/Mac/Linux — [SaaSHub: 4mapper](https://www.saashub.com/4mapper). Free trial, then PRO at "$39 one-time" with live widgets, unlimited projects and Arduino integration — [AlternativeTo: 4mapper](https://alternativeto.net/software/4mapper/about) (directory listing, not verified on the vendor site)
- **Maptastic.js**: "Javascript/CSS projection mapping utility" using CSS transforms. 311 stars, last push **2018-02-28**, abandoned — [GitHub glowbox/maptasticjs](https://github.com/glowbox/maptasticjs)
- **p5.mapper**: "library for projection mapping with p5.js". 118 stars, MIT, active (last push 2026-10-04) — [GitHub jdeboi/p5.mapper](https://github.com/jdeboi/p5.mapper)
- **three-projection-mapper**: three.js library with corner pins plus a bilinear/bicubic grid warp, multiple surfaces, SDF polygon masks, edge feather, per-surface color correction, testcard, and "multi-window mode: separate controller and projector windows, synced in real time (no server needed)". It also has a projector-camera class for throw ratio and lens shift. It warns: "Not recommended for production use yet". 19 stars, last push 2026-09-26 — [GitHub bhoffmann93/three-projection-mapper](https://github.com/bhoffmann93/three-projection-mapper)
- **Projection Mapping Web** (ProjectorVideoMappingWeb): vanilla JS + WebGL. Multi-layer 4-corner warp, file, camera and color sources, fullscreen. 18 stars; created and last pushed 2025-11-25 — [GitHub vitalyu/ProjectorVideoMappingWeb](https://github.com/vitalyu/ProjectorVideoMappingWeb)
- **OpenVJ**: "Real-time visual performance and projection mapping in your browser". v0.2.0 has quad corner pin, masks, video playback, generative presets, microphone audio reactivity and MIDI. It targets performers, installation artists and educators. 7 stars; active Apr–May 2026 only — [GitHub kniessner/openvj](https://github.com/kniessner/openvj)
- **quadcast-projection-mapper**: "Browser-based WebGL projection mapping tool with multi-surface corner pinning and arbitrary polygon masks" (2026-09) — [GitHub lionello06160/quadcast-projection-mapper](https://github.com/lionello06160/quadcast-projection-mapper)
- **Mapping** (eteriall): "Open-source browser-based projection mapping studio built with Next.js, Three.js, Django, and PostgreSQL". 1 star, last push 2026-10-15 — [GitHub eteriall/mapping](https://github.com/eteriall/mapping)
- **disguise Cloud "Mapping Matter"**: enterprise browser-based tools to plan and previsualize projection-mapping projects. Requires a paid disguise Cloud Studio account — [Liaison PR: disguise upgrades cloud platform](https://liaisonpr.com/news/disguise-upgrades-cloud-platform-to-include-mapping-matter/)
- **ledmapper**: "Web-based tool suite for mapping video content onto physical LED arrays (WS2812 / APA102)" — [GitHub zackees/ledmapper](https://github.com/zackees/ledmapper)
- Older JS mappers, all abandoned: project.js (last push 2013) and camara_lucida_js (2012) — [GitHub possan/project.js](https://github.com/possan/project.js); [GitHub chparsons/camara_lucida_js](https://github.com/chparsons/camara_lucida_js)

**F. Browser VJ apps and mixers (small or commercial)**
- **VJam**: "Browser-based VJ app" that turns a phone into a controller. Mic BPM detection, 180+ presets, touch gestures, blend modes, text, video and image layers, scenes. Vanilla JS + Web Audio + p5.js Canvas, offline PWA on Vercel. Free tier has 36 presets; the full version is $27 one-time. Show HN 2026-02-27 got 1 point and 0 comments — [HN 47178883](https://news.ycombinator.com/item?id=47178883); app at [vjam.vercel.app](https://vjam.vercel.app). A later Product Hunt listing claims 680+ presets mixing "MilkDrop classics + custom GPU shaders" — [Product Hunt: VJam](https://www.producthunt.com/p/vjam). Companion Chrome extension "VJam FX" overlays visuals on any website — [Chrome Web Store: VJam FX](https://chromewebstore.google.com/detail/gflgnfgemeniehmjjpcbhdphdppnmoaf)
- **Visual Fiha** (v3, browser): React control UI, Web Worker architecture, Monaco script editor, layer management, MIDI, mic/line-in, WebSocket inputs, and "connected display windows". 20 stars, last push 2026-09-10 — [GitHub zeropaper/visual-fiha](https://github.com/zeropaper/visual-fiha)
- **visualize** (Noise Factor): "Browser-based music visualizer and VJ gig player. Two decks, crossfader, audio-reactive shaders, MIDI, auto-VJ". 1 star, last push 2026-10-13 — [GitHub noisefactorllc/visualize](https://github.com/noisefactorllc/visualize)
- Other 2026 hobby browser-VJ instruments: null-signal (p5.js, WebGL compositor, 69 audio-reactive modes) — [GitHub cyberpatrolunit/null-signal](https://github.com/cyberpatrolunit/null-signal); vimathic ("Mathematical VJ studio in your browser") — [GitHub vimathic/vimathic](https://github.com/vimathic/vimathic); room-vj ("react to music, people, and synced nearby devices", WebGPU) — [GitHub baditaflorin/room-vj](https://github.com/baditaflorin/room-vj); WGSL-Multi-layer-VJ-WEB (WebGPU + Svelte 5, Hydra-style DSL) — [GitHub RTCK-DEV/WGSL-Multi-layer-VJ-WEB](https://github.com/RTCK-DEV/WGSL-Multi-layer-VJ-WEB)
- **ditherer**: browser image/video dithering, glitch and CRT/VHS filters, audio visualisation. 95 stars, active — [GitHub gyng/ditherer](https://github.com/gyng/ditherer)
- **Beact**: "DJ and VJ all by yourself in seconds". 292 stars, last push 2025-07-24 — [GitHub vibertthio/beact](https://github.com/vibertthio/beact)
- **Montage Organ**: "extremely simple in-browser MIDI-controlled VJ software" (2021) — [HN 27631783](https://news.ycombinator.com/item?id=27631783)
- **TekDetek**: browser live-video effects with no install, meant to be loaded in OBS — [hunted.space: TekDetek](https://hunted.space/product/tekdetek) (listing only)
- **AVVX** (AudioVisual Vector eXchange): open-source HTML5/SVG browser VJ tool from 2014 (Goldsmiths and Aalto) — [Correia & Kleimola, "Web Browser as Platform for Audiovisual Performances"](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf). Historic.
- **Ruido Visual Web VJ**: NLnet-funded (NGI0 Commons Fund plus Swiss SERI) "browser-based, libre" VJ studio. Multi-source compositing, effects, MIDI, audio reactivity, built on WHIP/WebRTC. Start date August 2026 — [NLnet: Ruido](https://nlnet.nl/project/Ruido/); repo [code.muchobueno.es](https://code.muchobueno.es/blinge/Ruido_Visual_Web-VJ_Project)

**G. Adjacent or discontinued**
- **Lightform** (projector hardware plus the free "Creator" software): announced its wind-down on Feb 7, 2022, with cloud services and support through August 2022. "As of August 12th, 2022, Lightform is no longer in business". The final Creator release removed cloud-dependent features (login, stock assets, IFTTT) — [Lightform announcement](https://lightform.com/?p=3093); [lightform.com](https://lightform.com/); [Lightform Labs](https://lightform.com/?p=2189). **Discontinued 2022-08-12.**
- **TouchDesigner**: no web-export path found. The Web Render TOP goes the other way, rendering web pages *inside* TD through Chromium Embedded Framework — [Derivative: Web Render TOP](https://derivative.ca/UserGuide/Web_Render_TOP); [Interactive & Immersive HQ](https://interactiveimmersive.io/blog/touchdesigner-integrations/useful-web-render-top-workflows-in-touchdesigner/)
- **VISUALZ CVJ-1 VJ Deck**: dedicated hardware (Ryzen V1605B) running Visualz PRO, with MIDI/OSC Learn, Syphon/Spout/NDI, RTMP, AI generation, and "BrowserStream" output to viewers' browsers. Pre-order $2,499 (list $3,599) — [visualzstudio.com/vj-deck](https://www.visualzstudio.com/vj-deck); [HN 47162292](https://news.ycombinator.com/item?id=47162292)
- Native open-source mappers that web tools compete with: MapMap (680 stars, active 2026-09) and Splash (523 stars, 2025-09) — [GitHub mapmapteam/mapmap](https://github.com/mapmapteam/mapmap); [GitHub paperManu/splash](https://github.com/paperManu/splash)

### Inferences
- The only web-tech tools with real communities (500+ stars and active) are Hydra, Butterchurn, cables.gl, modV and Hedron. None of them is a turnkey "Resolume-in-a-tab" with clip decks plus production mapping. Hydra and cables need code or patching, Butterchurn is a visualizer engine, and modV and Hedron are Electron apps without mapping.
- The 2026 wave of tiny browser mappers (OpenVJ, quadcast, eteriall/mapping, ProjectorVideoMappingWeb, three-projection-mapper) shows that corner-pin mapping in WebGL is now easy to build, often with AI coding tools. Commodity corner pin is not a moat. Polish, reliability, multi-output and the workflow are.
- Ghost Arcade is the closest direct analogue: open-core VJ plus mapping on web tech with a mobile companion and ISF. But it uses Electron rather than the browser, is very new, and has almost no traction.

### Gaps
- No evidence found of "Synesthesia-like" web apps with Synesthesia's depth. Synesthesia itself is native. No web version of Plane9 found. Nothing found under the name "VJ Party" (searches gave no relevant result).
- "VJ Loop" Electron apps: no product by that name found. The "vj electron" GitHub search only turned up small or abandoned repos (ko-yelie/vj-electron 2018, samradical/vj-electron-pi 2016).
- Sliider (desktop app that crossfades between web pages) was only mentioned in search snippets without a verifiable primary URL.
- The 4mapper vendor site was not fetched, so its pricing and feature list come from directory listings.

---

## Q2. Per-tool features, tech stack, maturity and business model

### Takeaway
Business models split three ways. Most tools are free/OSS and grant- or donation-funded (Hydra, cables, Punctual, Ruido via NLnet). A few are cheap one-time purchases (4mapper $39, VJam $27). A new open-core model is appearing (Ghost Arcade Community vs Pro). WebGL2 is the baseline renderer, WebGPU is only starting to appear (Stims, Ghost Arcade v0, room-vj), and Electron is the default escape hatch whenever native output (Spout/Syphon/NDI, multi-window) is needed.

### Cited Findings

| Tool | Render tech / shell | Layers / effects | Audio | MIDI | Multi-output / mapping | Maturity (2026-10-15) | Business model |
|---|---|---|---|---|---|---|---|
| Hydra | WebGL (regl-based engine `hydra-synth`), browser; WebRTC networking — [README](https://github.com/hydra-synth/hydra) | 4 output buffers o0–o3; chainable transforms; webcam sources — [README](https://github.com/hydra-synth/hydra) | `detectAudio` microphone option — [hydra-synth README](https://github.com/hydra-synth/hydra-synth) | Not verified (see Gaps) | Networked streams between browsers; no mapping | 2,729★, push 2026-04-25 | Free, AGPL-3.0; community grants — [grants](https://hydra.ojack.xyz/grants/recipients-2022) |
| cables.gl | WebGL patcher in browser + Electron standalone — [docs](https://cables.gl/docs/6_2_standalone/0_general/general) | Node ops incl. HTML/CSS ops, 3D, shaders — [CDM 2025](https://cdm.link/cables-june-2025/) | Web Audio ops (FFT, recording) + Ableton Link — [CDM 2025](https://cdm.link/cables-june-2025/) | Yes — [CDM 2025](https://cdm.link/cables-june-2025/) | Not a dedicated mapper | Very active; standalone v0.7.0 Jul 2025 — [downloads](https://cables.gl/downloads) | Free editing and hosting, MIT; NLnet grant Feb 2024–Apr 2025 — [NLnet](https://nlnet.nl/project/cables.gl/) |
| Nodes | JS/WebGL node env; desktop + web playground — [nodes.io](https://nodes.io) | Code blocks | n/a | n/a | n/a | v1.0.0-beta.3, Feb 2024 | Not stated on homepage |
| Butterchurn | WebGL 2 JS library — [README](https://github.com/jberg/butterchurn) | MilkDrop presets with blending | Web Audio node input | No | No | 1,968★, push 2026-04-20 | MIT, free |
| Stims | WebGL2 + WebGPU — [README](https://github.com/zz-plant/stims) | 1,787 `.milk` presets, live editor | Tab, YouTube, mic, file | Not stated | No | 12★, active | Free web app |
| Kaleidosync | Vue/D3/Three.js, WebGL — [README](https://github.com/zachwinter/kaleidosync) | Shader visualizers, dev mode with editable uniforms | Realtime in-browser analysis (v10) | No | No | 874★, push 2025-07-15 | Free (site kaleidosync.com) |
| modV | Electron + Vue + WebGL; ISF renderer — [repo](https://github.com/vcync/modV) | Modular modules incl. ISF | Web Audio | Yes (topic list) | NDI topic | 494★, release 3.30.0 Aug 2024 | Free OSS |
| Hedron | Electron + three.js — [README](https://github.com/nudibranchrecords/hedron) | Scenes, crossfade, post-FX, macros | Audio + BPM LFO | MIDI Learn, MIDI clock | External display | 516★, v1 alpha 2025-08 | Free OSS |
| Ghost Arcade | Electron + Svelte 5 + Three.js — [README](https://github.com/riskcapital/ghost-arcade-community) | Shader, video, 3D, splat, SVG, text layers; 50+ FX | System audio/mic FFT | WebMIDI + Learn | Quad + mesh warp, multi-output slicing | 11★, May 2026 | Open-core: Community free / Pro paid (Spout/Syphon, AI shaders, dual deck) |
| 4mapper | HTML5/JS, Chrome/Edge — [PH](https://www.producthunt.com/products/4mapper-web-based-projection-mapping) | Multi-scene; images/video/GIF | Not stated | Not stated | Corner-pin perspective | Launched 2026 | Freemium; PRO $39 one-time per [AlternativeTo](https://alternativeto.net/software/4mapper/about) |
| VJam | p5.js Canvas, PWA — [HN](https://news.ycombinator.com/item?id=47178883) | 180+ presets, blend modes, layers (paid) | Mic FFT + BPM | Not stated | No | Feb 2026 | Free tier + $27 one-time |
| OpenVJ | Browser, TypeScript — [README](https://github.com/kniessner/openvj) | Video, generative, masks | Mic FFT | MIDI | Quad warp, multi-surface | 7★, May 2026 | OSS |
| three-projection-mapper | three.js library — [README](https://github.com/bhoffmann93/three-projection-mapper) | Per-surface color, masks, feather | n/a | n/a | Corner + bicubic grid, multi-window | 19★, Sep 2026, "not production" | OSS |
| Visual Fiha | Browser, React + Web Workers — [README](https://github.com/zeropaper/visual-fiha) | Canvas 2D + WebGL layers, scripts | Mic/line-in | MIDI | Display windows | 20★, Sep 2026 | Personal, non-commercial |
| Ruido | Browser, WHIP/WebRTC — [NLnet](https://nlnet.nl/project/Ruido/) | Multi-source compositing, FX | Yes | Yes | n/a | Grant starts Aug 2026 | Libre, grant-funded |

- cables.gl hosting and editing are free. CDM's author doubts the audience is large enough to support a commercial tool of this kind — [CDM: cables June 2025](https://cdm.link/cables-june-2025/)
- cables.gl was already promoted in 2020 as a way to "build a 3D VJ tool from scratch in browser" — [CDM 2020](https://cdm.link/2020/09/build-a-3d-vj-tool-from-scratch-in-browser-in-the-free-cables-gl-beta/). It went fully MIT and offline-capable in 2024 — [CDM 2024: cables open/offline](https://cdm.link/2024/08/cables-gl-open-offline/)
- modV builds need node-gyp native modules (Visual Studio Tools and Python on Windows), so it depends on native code beyond pure web tech — [GitHub vcync/modV README](https://github.com/vcync/modV)
- Visual Fiha was first a browser app (2014, when Web MIDI was announced), then a VS Code extension, then a browser app again, because in the extension "latency of real time audio processing became unacceptably high" — [GitHub zeropaper/visual-fiha](https://github.com/zeropaper/visual-fiha)
- Ghost Arcade's mobile companion is served at `http://<lan-ip>:9002` for iPad or phone control (clip launcher, mixer, master fader, effects, shader params) — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community)
- AVVX (2014) moved from a Flash standalone to the browser for iOS reach and open source. Its target audience was "artists and designers with little or no VJing experience" — [Correia & Kleimola paper](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)

### Inferences
- Pricing anchors in the web segment are very low ($27–$39 one-time). Natively, HeavyM is freemium and Resolume/MadMapper are premium (see the vendor alternatives page in Q5). A browser tool that charges more needs clear pro features: multi-output, mesh warp, edge blend, show reliability, and remote control.
- "Production readiness" is what the web set lacks most. Tools either self-describe as experimental (Hydra: "experimental/in development"; three-projection-mapper: "Not recommended for production use yet") or are alpha (Hedron v1 alpha, PhysMap alpha).

### Gaps
- Hydra's MIDI support: the README excerpt reviewed did not cover it, and a search found no release notes ("Hydra 1.4") or MIDI documentation. Hydra users commonly wire up Web MIDI by hand, but no primary source was found to confirm this.
- Nodes.io pricing and license: the homepage does not state them.
- Butterchurn has no tagged GitHub releases, so its last npm release date was not retrieved.
- No user counts or revenue figures were found for any web tool.

---

## Q3. Interoperability standards a web VJ and mapping tool should adopt

### Takeaway
The de-facto interop stack is: **ISF** for shader effects and generators (JSON header + GLSL, with an existing MIT WebGL renderer, though aging), **Shadertoy and GLSL Sandbox import** through ISF conversion, **MilkDrop `.milk` presets** (Butterchurn JSON or native `.milk` as in Stims), **Web MIDI** (Chromium and Firefox only), **OSC carried over WebSocket** (osc.js `WebSocketPort`), and the **Resolume REST + WebSocket API** (v7.8+) as the control-API model. Resolume's Advanced Output XML is a common mapping-interchange target in the ecosystem.

### Cited Findings
**ISF (Interactive Shader Format)**
- ISF is "a slightly modified GLSL fragment shader with a JSON blob at the beginning that tells host software how to interact with it". ISF files can be created, viewed and shared online at isf.video — [ISF docs: Using ISF](https://docs.isf.video/using_isf); [ISF Primer (v2)](https://docs.isf.video/primer/); [ISF Spec on GitHub](https://github.com/mrRay/ISF_Spec); [ISF Quick Start](https://docs.isf.video/quickstart)
- The ISF web shader library is at editor.isf.video — [Cascade docs: Using ISF shaders](https://cascadedocs.readthedocs.io/en/latest/isfshaders.html). A desktop ISF Editor (Mac and Windows) adds error messages and per-pass preview, and its code is in VVISF-GL — [ISF desktop editor](https://isf.vidvox.net/desktop-editor/)
- ISF is supported by pro hosts beyond VDMX, for example Modulo Kinetic "FX ISF" — [Modulo Kinetic manual](https://support.modulo-pi.com/modulo-kinetic-manual/v6/en/topic/fx-isf) — and igloo — [igloo docs](https://docs.igloovision.com/documentation/1.4.0/interactive-shader-effects-isf). One host notes "the ISF specification has not been fully implemented" — [Cascade docs](https://cascadedocs.readthedocs.io/en/latest/isfshaders.html)
- **interactive-shader-format-js**: "Renders ISF Effects and Compositions into a canvas". API: `ISFRenderer(gl)`, `loadSource`, `setValue`, `pushTextures`, `draw`, and `ISFParser`. The example uses a `webgl` (v1) context. MIT, 107 stars, 20 open PRs, last push 2025-12-31 — [GitHub msfeldstein/interactive-shader-format-js](https://github.com/msfeldstein/interactive-shader-format-js)
- modV has its own ISF renderer (`src/application/renderers/isf.js`) and ISF sample modules — [GitHub vcync/modV](https://github.com/vcync/modV). Ghost Arcade advertises a "Live ISF shader playground… with the full ISF v2 spec" — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community)

**Shadertoy and GLSL Sandbox**
- The ISF Editor's File menu imports Shadertoy and GLSL Sandbox URLs and "attempts to translate" them. Multi-buffer Shadertoy shaders are the main trouble spot, and multi-pass conversion can produce variable name collisions — [VIDVOX ISF Editor docs](https://docs.vidvox.net/isf-editor/); [ISF Editor: converting shaders](https://isf.vidvox.net/tutorials/converting-shaders); [ISF Primer ch. 9: Adapting existing GLSL code](https://docs.isf.video/primer_chapter_9). Users report that some Shadertoy buffer shaders and GLSL Sandbox imports fail — [Magic Music Visuals forum](https://magicmusicvisuals.com/forums/viewtopic.php?p=12656)
- Many Shadertoy and GLSL Sandbox shaders do not use alpha because they were not written for compositing — [ISF Editor: converting shaders](https://isf.vidvox.net/tutorials/converting-shaders)

**MilkDrop**
- Butterchurn uses presets from the `butterchurn-presets` package (`getPresets()`, `loadPreset(preset, blendSeconds)`) — [GitHub jberg/butterchurn](https://github.com/jberg/butterchurn). Stims states that Butterchurn presets are "Converted to JSON first", while Stims and projectM use `.milk` as-is. A CI run compiles all 1,750 Butterchurn-pack presets for WebGL2 and WebGPU: 1,578 run with no approximation — [GitHub zz-plant/stims](https://github.com/zz-plant/stims)

**MIDI**
- Web MIDI: supported in Chrome (since 43), Edge and Firefox (since 108). **Safari: not supported**. WebKit bug 107250 is still open — [WebKit Bugzilla 107250](https://bugs.webkit.org/show_bug.cgi?id=107250); [MDN browser-compat-data snapshot](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/73d346309ee9d8be7e32fda8ff574d4c79dd4c51/api/MIDIAccess.json). Chrome now requires a user permission prompt for MIDI access — [Chrome blog: Web MIDI permission prompt](https://developer.chrome.com/blog/web-midi-permission-prompt?hl=nl). The W3C Web MIDI working draft (July 2024) — [W3C Web MIDI](https://www.w3.org/TR/2024/WD-webmidi-20240712/)

**OSC over WebSocket**
- osc.js is "transport agnostic". It provides `osc.WebSocketPort` for browsers, while UDP ports are only available in Node.js and Chrome Apps. 831 stars, last push 2024-08-20. The GitHub API reports the license as GPL-2.0 — [GitHub colinbdclark/osc.js](https://github.com/colinbdclark/osc.js)

**Resolume API as de-facto control standard**
- Resolume 7.8 introduced a REST API and webserver for Arena, Avenue and Wire: "get and set any parameter value in the composition" plus clip thumbnails — [Resolume blog 7.8](https://www.resolume.com/blog/21137/resolume-7-8-control-amp-monitor-arena-avenue-and-wire-via-the-rest-api); [CDM Dec 2021](https://cdm.link/2021/12/resolume-7-8s-rest-api-turns-your-visual-tools-into-web-servers-you-can-access/)
- The REST API covers columns, layers, groups, effects and thumbnails. It must be enabled in Preferences — [Resolume: REST API & Webserver](https://resolume.com/article/132)
- The WebSocket API runs at `ws://address:port/api/v1`. Messages look like `{action, parameter}`, with actions `subscribe`, `unsubscribe`, `set`, `get`, `reset` and `trigger`. Paths are by ID (`/parameter/by-id/<id>`) or logical (`/composition/columns/1/name`). `post`/`remove` add or delete objects (`remove` because `delete` is a JS keyword). The server pushes `sources_update` and `effects_update` on connect. The reference is a Swagger UI, and examples are on gitlab.resolume.com — [Resolume Websocket API](https://resolume.com/support/en/websocket-api); [Resolume REST API reference (Swagger)](https://resolume.com/docs/restapi/)
- Ecosystem tools target Resolume formats and APIs. beatsync "fires your Resolume clips on the beat over OSC" — [GitHub mochaheree/beatsync](https://github.com/mochaheree/beatsync). ROAGEN generates "Resolume Arena Advanced Output XML" from SVG — [GitHub vjzotz/ROAGEN-](https://github.com/vjzotz/ROAGEN-). UnMapper "Reads a Resolume Arena Advanced Output" — [GitHub stoatworks-labs/UnMapper](https://github.com/stoatworks-labs/UnMapper). theDAW claims interoperability "w/ Ableton, Reaper, Resolume" — [GitHub gantasmo/theDAW](https://github.com/gantasmo/theDAW)

**Other**
- Ableton Link is supported in cables.gl — [CDM: cables June 2025](https://cdm.link/cables-june-2025/)
- WHIP/WebRTC is the chosen video ingest and transport standard for Ruido Web VJ — [NLnet: Ruido](https://nlnet.nl/project/Ruido/)
- Spout, Syphon and NDI are only available to web-tech tools through Electron or native shells. Ghost Arcade puts Spout/Syphon in its paid Pro tier — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community). modV lists NDI — [GitHub vcync/modV](https://github.com/vcync/modV)

### Inferences
- A web-first tool should (1) load and save ISF v2 as its native effect and generator format, ideally with a modern WebGL2/WebGPU ISF renderer because the reference JS renderer is WebGL1-era and has 20 unmerged PRs; (2) offer Shadertoy paste-import with automatic `iTime`/`iResolution`/`iChannel` mapping and handle multi-buffer shaders, the known weak spot of the ISF Editor; and (3) expose a Resolume-shaped JSON/WebSocket control API (subscribe/set/get/trigger on path-addressed parameters). That makes existing Companion- and OSC-style controller ecosystems easy to adapt.
- OSC from a browser needs a bridge, because browsers cannot open UDP sockets. Options are a tiny local relay, Electron or Tauri, or a companion app. Plan an "OSC over WebSocket" bridge in addition to native OSC.
- Importing and exporting Resolume Advanced Output XML would be a strong differentiator for mapping interchange, given the third-party tools that already parse and generate it.

### Gaps
- shadertoy.com/howto returned HTTP 403, so the Shadertoy uniform list (iTime, iResolution, iChannel0–3, iMouse, iFrame, iDate, audio texture layout) is not cited from a primary source here.
- No primary Resolume OSC documentation was fetched. The OSC address scheme is not documented in these notes.
- The osc.js license may be dual MIT/GPL. The API reports GPL-2.0 only, so check the LICENSE file before bundling.
- No WebGL2 or WebGPU ISF renderer other than modV's internal one and Ghost Arcade's was found as a standalone library.

---

## Q4. Known pain points of browser VJ and mapping, and how existing tools solved them

### Takeaway
The recurring blockers are: multi-display fullscreen output (only Chromium's Window Management API, permission-gated, one window per user gesture), codec limits (no HAP, ProRes or DXV in the browser), autoplay and audio gestures, uneven Web MIDI and WebGL2/WebGPU support across browsers, audio-reactive latency, and no native texture sharing (Spout, Syphon, NDI). Existing tools work around these by targeting Chromium only, using controller and projector windows synced locally, moving to Electron for output and native I/O, and using Web Workers and GPU-side computation for performance.

### Cited Findings
**Multi-display and fullscreen on a second screen**
- `getScreenDetails()` is supported in Chrome 100+ and Edge 100+. **Firefox and Safari: not supported** — [web.dev: How to use multiple screens](https://web.dev/articles/web-apps/multiple-screens)
- The Window Management API needs the `window-management` permission and a secure context. It adds `requestFullscreen({ screen })`. "A separate user gesture is required for each `Window.open()` call", so the suggested workarounds are opening one window at a time, reusing windows, or asking users to allow popups. The `screenschange` event detects hot-plugged projectors — [MDN: Using the Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API/Using)
- Solutions in the field: three-projection-mapper uses a "Multi-window mode: separate controller and projector windows, synced in real time (no server needed)" — [GitHub bhoffmann93/three-projection-mapper](https://github.com/bhoffmann93/three-projection-mapper). PhysMap and Hedron use Electron to open a dedicated black fullscreen projector window or an external display — [GitHub mirauta-alexandru/PhysMap](https://github.com/mirauta-alexandru/PhysMap); [GitHub nudibranchrecords/hedron](https://github.com/nudibranchrecords/hedron). Visual Fiha manages "connected display windows" — [GitHub zeropaper/visual-fiha](https://github.com/zeropaper/visual-fiha)
- In the AVVX user study (2014), testers wanted "two different screens", one for the GUI and one for the output, and found the in-output GUI elements "quite small" and distracting — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)

**Browser fragmentation**
- Hydra's README: "Right now only works on Chrome or Chromium, on machines with WebGL" — [GitHub hydra-synth/hydra](https://github.com/hydra-synth/hydra)
- Butterchurn requires WebGL 2 — [GitHub jberg/butterchurn](https://github.com/jberg/butterchurn). 4mapper supports only Chrome and Edge — [SaaSHub: 4mapper](https://www.saashub.com/4mapper)
- No Web MIDI in Safari. A WebKit bug comment says this has pushed musicians to Chrome — [WebKit Bugzilla 107250](https://bugs.webkit.org/show_bug.cgi?id=107250)

**Video codecs and decode performance**
- HAP stores each frame as a GPU block-compressed texture (DXT/BC). Hap Q Alpha needs a YCoCg plane plus an RGTC1 alpha plane combined in a shader. The reference encoder and decoder are native — [GitHub vidvox/hap](https://github.com/vidvox/hap); [Bluecadet Unity HAP formats](https://unity.bluecadet.com/hap/formats/). No browser-side JS HAP decoder was found in search.
- WebCodecs decoders handle H.264, H.265 and AV1 (not HAP), with rendering through WebGL — [Tango docs: WebCodecs decoder](https://docs.tangoapp.dev/1.0.0/scrcpy/video/web-codecs)
- WebGPU `importExternalTexture()` can sample video frames "potentially in a 0-copy way directly from the source YUV". Since Chrome 116 it accepts WebCodecs `VideoFrame`, and importing from an `HTMLVideoElement` stops Chrome from throttling off-screen video playback — [Chrome: New in WebGPU 116](https://developer.chrome.com/blog/new-in-webgpu-116?hl=en)
- Developers are benchmarking this themselves. frame-lab is "a browser video playback benchmark comparing HTML video pools, WebCodecs frame caches, and preloaded…" (Oct 2026) — [GitHub gordo-v1su4/frame-lab](https://github.com/gordo-v1su4/frame-lab)

**Autoplay and audio policies**
- Chrome always allows muted autoplay. Autoplay with sound needs a user gesture on the domain or, on desktop, a crossed Media Engagement Index. Command-line flags can disable the policy, which is relevant for kiosk and Electron deployments — [Chrome: Autoplay policy](https://developer.chrome.com/blog/autoplay). Safari uses a gesture and interaction-history approach — [Bitmovin: autoplay policies](https://bitmovin.com/autoplay-policies-safari-14-chrome-64/)
- Example UX workaround: Stims is "calm by default. Nothing plays until you start audio", and "a click on the page turns the sound on" — [GitHub zz-plant/stims](https://github.com/zz-plant/stims). Hydra recommends `detectAudio: false` "to avoid asking for microphone" — [GitHub hydra-synth/hydra-synth](https://github.com/hydra-synth/hydra-synth)

**Latency and performance**
- AVVX measured worst-case spectral-energy latency at 60 ms (2048-sample FFT plus a 60 Hz refresh). Smaller buffers lowered latency but hurt rendering performance. Testers reported "occasional slowness… with more complex graphics" — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)
- Visual Fiha left the VS Code extension model because audio latency became "unacceptably high", and re-architected around Web Workers — [GitHub zeropaper/visual-fiha](https://github.com/zeropaper/visual-fiha)
- Stims moves MilkDrop per-pixel equations onto the GPU (WebGPU) for 1,094 of 1,102 presets with per-pixel code — [GitHub zz-plant/stims](https://github.com/zz-plant/stims)

**Native I/O, files and platform risk**
- AVVX needed a local HTTP server or cloud upload to load media (pre-File-System-Access era) — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)
- No Spout, Syphon or NDI in the browser. Web-tech tools that need them ship in Electron: Ghost Arcade Pro (Spout/Syphon) — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community); modV (NDI, native node-gyp modules) — [GitHub vcync/modV](https://github.com/vcync/modV); cables standalone — [cables docs](https://cables.gl/docs/6_2_standalone/0_general/general)
- Platform-dependency failures: VEDA died with Atom — [GitHub fand/veda](https://github.com/fand/veda); [GitHub blog: Sunsetting Atom](https://github.blog/2022-06-08-sunsetting-atom/). Spotify-dependent visualizers lost audio-features data (403 errors; a forum user claims only apps with quota extensions before Nov 27, 2024 keep access) — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/m-p/6778841/highlight/true). Kaleidosync then moved to in-browser realtime analysis — [GitHub zachwinter/kaleidosync](https://github.com/zachwinter/kaleidosync). Lightform's final Creator release dropped cloud-dependent features when the company closed — [Lightform Labs](https://lightform.com/?p=2189)

### Inferences
- For a production tool, "Chromium-only, installable PWA" is a defensible baseline: Window Management, Web MIDI, WebGPU and WebCodecs are all Chromium-first. An optional thin desktop shell (Electron or Tauri) can unlock Spout/Syphon/NDI, UDP OSC, kiosk autoplay flags and reliable multi-window startup.
- The controller-window plus projector-window pattern (BroadcastChannel or shared state, no server) is now standard and should come with: auto-placement on the projector via `getScreenDetails()`, hot-plug handling via `screenschange`, and a one-click recovery flow for blocked popups.
- Codec strategy: transcode to H.264/H.265/AV1 for WebCodecs plus `importExternalTexture`, or implement HAP decode as raw DXT/BC texture upload. HAP via compressed-texture upload is plausible but unproven in the browser, so it would be a differentiator if done.
- Avoid single-vendor dependencies (editor plugins, music-streaming APIs, mandatory cloud), which have already killed or crippled several tools.

### Gaps
- No primary measurements found of WebGL/WebGPU video-layer throughput (for example, how many 1080p layers at 60 fps) in browser VJ tools.
- Whether `requestFullscreen({screen})` can keep fullscreen windows on several projectors at once was not confirmed by MDN or web.dev.
- No data on audio-input latency of `getUserMedia` plus AnalyserNode on modern Chromium.

---

## Q5. Differentiation opportunities for a web-first tool, and evidence of demand

### Takeaway
Zero-install, phone remote control, link-shareable sessions and collaboration are already being tried, but only in hobby-scale or code-centric tools. AI generation is moving into native and Electron VJ products (Visualz, Ghost Arcade Pro). Public funding (NLnet) explicitly backs browser VJ tools as low-cost, libre alternatives for creators, educators and streamers. But commercial browser launches on Product Hunt and HN got almost no traction, so distribution and trust (show reliability) are the real hurdles, not technical feasibility.

### Cited Findings
**Zero-install, cheap, cross-platform**
- 4mapper sells "no installation" browser mapping as an accessible alternative to MadMapper and Resolume, starting free with a one-time PRO — [Product Hunt](https://www.producthunt.com/products/4mapper-web-based-projection-mapping); [AlternativeTo](https://alternativeto.net/software/4mapper/about)
- Punctual: "zero-installation" — [GitHub dktr0/Punctual](https://github.com/dktr0/Punctual). Stims: "Any WebGL2 browser; no account, no install" — [GitHub zz-plant/stims](https://github.com/zz-plant/stims). ProjectorVideoMappingWeb: "No Installation - Runs entirely in your browser" — [GitHub vitalyu/ProjectorVideoMappingWeb](https://github.com/vitalyu/ProjectorVideoMappingWeb)
- A vendor alternatives page lists the 2026 MadMapper alternatives landscape and positions HeavyM for no-code creators. It also says MadMapper has a steep learning curve (vendor bias) — [HeavyM blog: Best MadMapper Alternatives 2026](https://www.heavym.net/best-madmapper-alternatives-for-projection-mapping/). Free native options cited by directories: MapMap ("can crash occasionally" but handled basic Halloween projection, per a Reddit user quoted by SaaSHub), Splash, and HeavyM freemium — [SaaSHub: MapMap vs Resolume](https://www.saashub.com/compare-mapmap-vs-resolume); [AlternativeTo: MadMapper alternatives](https://alternativeto.net/software/madmapper/)
- Linux options are scarce and often limited: Showout runs on Linux with a free tier whose "Program Output is always watermarked", and Veejay is marked discontinued on one listing — [AlternativeTo: Showout](https://alternativeto.net/software/showout/about/); [AlternativeTo: VIDIFOLD alternatives](https://alternativeto.net/software/iqsynth). Older Linux-audio-list thread asking for VJ software alternatives — [LAU 2014](https://lists.linuxaudio.org/archives/linux-audio-user/2014-July/098070.html)

**Remote control from phone or tablet**
- Ghost Arcade's LAN mobile companion (clip launcher, mixer, FX, shader params) — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community). VJam "turns your phone into a live visual controller" — [HN 47178883](https://news.ycombinator.com/item?id=47178883). Visualz has "CrowdStream" (phone-based light and strobe sync) and "FanCam" (audience phones as live sources) — [visualzstudio.com/vj-deck](https://www.visualzstudio.com/vj-deck)
- Precedent: a 2017 case study of a VJ PWA running on a Samsung S8, controlled by a MIDI controller — [Ruth John, "VJ On The Go"](https://medium.com/@rumyra/vj-on-the-go-e56666fe55eb)
- AVVX testers preferred the laptop for preparation and the iPad for performance ("more intuitive", better audience contact) — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)

**Collaboration, multiplayer and sharing**
- Hydra's core concept is networked browser-to-browser video streams over WebRTC — [GitHub hydra-synth/hydra](https://github.com/hydra-synth/hydra). Flok (P2P collaborative live-coding editor, now archived) — [GitHub munshkr/flok](https://github.com/munshkr/flok). Estuary ("collaboration and learning") — [GitHub dktr0/estuary](https://github.com/dktr0/estuary). room-vj (visuals "synced nearby devices") — [GitHub baditaflorin/room-vj](https://github.com/baditaflorin/room-vj)
- Stims: "The address bar is the session. Whoever opens it sees the same preset, edits included" — [GitHub zz-plant/stims](https://github.com/zz-plant/stims)
- Cloud sharing: isf.video shader sharing (public or private) — [ISF docs](https://docs.isf.video/using_isf); cables free hosting — [CDM 2025](https://cdm.link/cables-june-2025/); 4mapper cloud project storage — [Product Hunt](https://www.producthunt.com/products/4mapper-web-based-projection-mapping); Ghost Arcade "cloud shader sync" — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community)
- AVVX users valued an online library for remixing and asked for tagging and thumbnail browsing. 8 of 12 respondents rated open source "very important" — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf)

**AI-assisted content**
- Ghost Arcade Pro: AI shader generation — [GitHub riskcapital/ghost-arcade-community](https://github.com/riskcapital/ghost-arcade-community). Visualz: AI generation of shaders, video, 3D models, textures and plugins — [visualzstudio.com/vj-deck](https://www.visualzstudio.com/vj-deck). subjective-zero: "The agentic node editor for live visual effects" (Swift, native) — [GitHub sxp-studio/subjective-zero](https://github.com/sxp-studio/subjective-zero). vj_vid: "Browser-based AI image & video generation — SD-Turbo + RIFE, 100% client-side" — [GitHub VJPatz/vj_vid](https://github.com/VJPatz/vj_vid). theDAW: DAW/DJ/VJ with Stable Audio 3 and Magenta RT — [GitHub gantasmo/theDAW](https://github.com/gantasmo/theDAW). AI "VJ" content generators such as freebeat.ai are aimed at DJs — [freebeat.ai for DJs](https://freebeat.ai/for-djs)

**Education**
- OpenVJ lists "Educators – Teach projection mapping and real-time graphics" as a target segment — [GitHub kniessner/openvj](https://github.com/kniessner/openvj). Estuary is built for "learning through live coding" — [GitHub dktr0/estuary](https://github.com/dktr0/estuary). AVVX was evaluated in workshops with mostly students (only 1 of 12 respondents had VJ experience) — [Correia & Kleimola](https://eprints-gro.gold.ac.uk/11077/1/WebBrowserPlatformAVPerform.pdf). Hydra funds tutorial-writing grants — [Hydra grants 2022](https://hydra.ojack.xyz/grants/recipients-2022). p5.mapper brings mapping to the p5.js education ecosystem — [GitHub jdeboi/p5.mapper](https://github.com/jdeboi/p5.mapper)

**Evidence of demand and supply signals**
- **Public funding:** NLnet/NGI0 funds Ruido Visual Web VJ as a browser-based "alternative to expensive closed-source VJ software" for independent creators, educators and live streamers (start Aug 2026) — [NLnet: Ruido](https://nlnet.nl/project/Ruido/). NLnet also funded the cables.gl standalone (Feb 2024–Apr 2025) — [NLnet: cables.gl](https://nlnet.nl/project/cables.gl/)
- **Builder activity:** many browser or web-tech VJ and mapping repos created or very active in 2026 (OpenVJ, Ghost Arcade, quadcast, eteriall/mapping, three-projection-mapper, Prism Mapper, PhysMap, visualize, null-signal, vimathic, room-vj) — see Q1 URLs. Hedron came back into development — [GitHub nudibranchrecords/hedron](https://github.com/nudibranchrecords/hedron)
- **Hobbyist interest:** an HN post "I built a ceiling projection mapping of the planes flying over my house" got 229 points and 32 comments (June 2026). It was cross-posted from r/ClaudeCode, which suggests AI-assisted hobby builds — [HN 48383823](https://news.ycombinator.com/item?id=48383823); [HN 48456242](https://news.ycombinator.com/item?id=48456242)
- **Weak commercial launch traction:** 4mapper on Product Hunt got 1 upvote and 4 followers — [Product Hunt](https://www.producthunt.com/products/4mapper-web-based-projection-mapping). VJam's Show HN got 1 point and 0 comments — [HN 47178883](https://news.ycombinator.com/item?id=47178883). Visualz CVJ-1's Show HN got 1 point — [HN 47162292](https://news.ycombinator.com/item?id=47162292). VJam FX Chrome extension: 8 users — [Chrome Web Store](https://chromewebstore.google.com/detail/gflgnfgemeniehmjjpcbhdphdppnmoaf)
- **Market-size skepticism:** CDM doubts there is a large enough audience to support a commercial cables-like tool — [CDM: cables June 2025](https://cdm.link/cables-june-2025/)
- **Low-cost event and home market:** Halloween house projection is a recurring use case: Lightform content — [Lightform: Halloween projection mapping on a house](https://lightform.com/?p=2270); a MapMap user doing Halloween projection — [SaaSHub](https://www.saashub.com/compare-mapmap-vs-resolume)
- A Reddit r/vjing post from a Linux user with a weak laptop asking for software options appeared only via a Reddit mirror in search results. It named no tools — [reddit mirror r/vjing](https://reddit.sudovanilla.org/r/vjing/controversial) (low-reliability mirror)

### Inferences
- **The gap:** no product combines (1) runs in a normal Chromium tab or installable PWA, (2) Resolume-style clip decks, layers, effects and BPM, (3) MadMapper-grade mapping (mesh or bicubic warp, masks, edge blend, multi-output with auto-placement on projectors), (4) open interop (ISF, Shadertoy import, MilkDrop, Web MIDI Learn, an OSC/WebSocket bridge, a Resolume-shaped API), and (5) explicit show-reliability features (offline PWA, crash-safe autosave, a fallback/black-out panic button). Ghost Arcade comes closest on features but is Electron, open-core and pre-traction. 4mapper and OpenVJ are browser-native but feature-thin.
- **Strongest web-unique differentiators:** a phone or tablet remote via QR code with no app install, link-shareable projects and "rigs", real-time co-editing of a mapping on site (one person at the projector, one on the laptop), and a cloud library of ISF and Shadertoy content. AI generation (shader-from-prompt, auto-masking from a camera photo of the surface) is now table stakes in new pro entrants, so it is not a unique moat.
- **Go-to-market:** the low upvote counts suggest launch posts alone do not work. Education (workshops, schools, Chromebooks where native tools cannot install), low-budget events and Halloween/home mapping, and the Linux and Chromebook gap look like better wedge segments than competing head-on with Resolume pros. Grant funding (NLnet/NGI0) is a realistic option for an OSS core.

### Gaps
- Reddit (r/vjing, r/projectionmapping, r/creativecoding) could not be accessed: search and fetch were blocked (HTTP 400 / non-JSON). Direct quotes asking for browser, cheap, Linux or Chromebook tools could not be gathered, so demand evidence relies on grants, GitHub activity, HN and Product Hunt.
- No Chromebook-specific VJ or mapping guidance or demand data found.
- No market-size data (number of VJs, mapping hobbyists or education seats) found.
- No pricing or revenue data for Ghost Arcade Pro was found on its site (not fetched).
