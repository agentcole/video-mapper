# Codebase Audit — Video Mapper (state at commit cea802b, audited 2026-10-15)

Scope and method: every file in `src/` (5,265 lines) plus README.md, TODO.md, package.json, vite/eslint/ts configs, index.html, main.tsx and git history were read in full. Links are repo-relative (`../../` = repo root). Labels used below:
- **[code]**: read directly in source.
- **[build]**: output of `npx tsc -b`, `npx vite build --outDir <scratch>` (the same as `npm run build`, but written outside the repo) and `npm run lint` / `npx eslint src`, all run 2026-10-15 with node v22.19.0 / npm 11.6.0.
- **[runtime]**: measured in Chrome against a `vite preview` of the current build, using synthetic mouse events and DOM inspection. This was in an isolated browser context; no repo files were changed.
- **[numeric]**: a Node script that imports the real `src/lib/geometry.ts`.

Inferences are kept separate from verified findings.

## 1. Feature inventory (what really exists, status, README/TODO claims vs code)

### Takeaway
The app is a capable single-window, DOM-based mapping editor: rect, circle and polygon frames; 4-corner pin; composition resolution; layers panel; undo/redo; IndexedDB media library; export with embedded media. Several headline features are partial or buggy, though. Blend modes have no visible effect against other layers (verified at runtime). Polygon and triangle editing under corner pin is inconsistent. Triangles closed by double-click get a duplicate vertex (verified at runtime). Several README claims (performance, IndexedDB projects, background sync, React 18, accessibility) are not backed by the code.

### Cited Findings
**Feature status table** (C = complete, P = partial, B = buggy, — = absent)

| Feature | Status | Evidence |
|---|---|---|
| Media types: video and image only (`MediaType = 'video' \| 'image'`) | C | [src/types.ts:3](../../src/types.ts) |
| Background: color, image or video; image and video only from the library | C/P | [src/types.ts:7](../../src/types.ts), [src/components/Canvas.tsx:1340-1364](../../src/components/Canvas.tsx), [src/components/BackgroundSettings.tsx:139-183](../../src/components/BackgroundSettings.tsx) |
| Shapes: `rectangle \| circle \| polygon`; there is no triangle type (a triangle is a 3-vertex polygon) | C | [src/types.ts:4](../../src/types.ts) |
| Drawing: rect/circle by drag (min 20 px); polygon by click, closed by double-click or by a click within 20/viewScale px of the first vertex | **B** | [src/components/Canvas.tsx:676-754](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:976-1015](../../src/components/Canvas.tsx) |
| — Double-click close adds a duplicate vertex: every mousedown adds a vertex ([Canvas.tsx:708-714](../../src/components/Canvas.tsx)), and `finishPolygon` does not de-duplicate ([Canvas.tsx:627-673](../../src/components/Canvas.tsx)). **[runtime]** A 3-click + double-click triangle was saved as 4 vertices `[[0,1],[0.5,0],[1,1],[1,1]]`. | **B** | runtime check |
| Move (group drag, snap) | C | [src/components/Canvas.tsx:761-793](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:846-858](../../src/components/Canvas.tsx) |
| Resize with 8 handles, rotation-aware, min 50 px, aspect lock; **not available for polygons** (`frame.shape !== 'polygon'`) | P | [src/components/Canvas.tsx:862-948](../../src/components/Canvas.tsx), [src/components/MediaFrame.tsx:640](../../src/components/MediaFrame.tsx) |
| Rotate (green handle, about the bbox centre) | C | [src/components/Canvas.tsx:819-836](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:951-958](../../src/components/Canvas.tsx) |
| Corner pin / perspective (4 offsets from bbox corners, snap, reset, scaled on handle resize) | P (see Q3) | [src/components/MediaFrame.tsx:182-194](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:922-960](../../src/components/MediaFrame.tsx), [src/components/Canvas.tsx:933-945](../../src/components/Canvas.tsx) |
| Polygon texture mode `clip` vs `warp`; warp works only for exactly 4 vertices, otherwise silently falls back to clip | P/B | [src/components/MediaFrame.tsx:334-342](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:912-918](../../src/components/MediaFrame.tsx) |
| Polygon vertex editing (purple handles; vertices clamped to 0..1) | P/B under corner pin | [src/components/MediaFrame.tsx:166-180](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:653-673](../../src/components/MediaFrame.tsx) |
| Soft edges: 4 per-edge linear gradient masks on the content element (bbox edges only, no gamma/curve) | P | [src/components/MediaFrame.tsx:397-430](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:1128-1152](../../src/components/MediaFrame.tsx) |
| Test cards: per-frame (warps with the frame) and global output | C | [src/components/TestCard.tsx:14-73](../../src/components/TestCard.tsx), [src/components/MediaFrame.tsx:496-503](../../src/components/MediaFrame.tsx), [src/components/Canvas.tsx:1411-1419](../../src/components/Canvas.tsx) |
| Composition resolution: presets 720p–4K plus custom 320–8192; letterboxed stage. Changing the resolution does **not** rescale frames. | C/P | [src/components/ControlPanel.tsx:59-66](../../src/components/ControlPanel.tsx), [src/components/ControlPanel.tsx:384-436](../../src/components/ControlPanel.tsx), [src/components/Canvas.tsx:188-190](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1263](../../src/components/Canvas.tsx) |
| Master fader (opacity wrapper) and blackout (black overlay at z 950, key B); not persisted; **they do not touch audio** | P | [src/components/Canvas.tsx:162-165](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1338](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1497-1499](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:607-610](../../src/components/Canvas.tsx) |
| Grid overlay and snap (8–128 px, G / Shift+G, optional in present mode, persisted) | C | [src/components/Canvas.tsx:216-219](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1389-1408](../../src/components/Canvas.tsx), [src/components/ControlPanel.tsx:334-382](../../src/components/ControlPanel.tsx) |
| Layers panel: visibility, rename, up/down reorder, duplicate, delete, numeric X/Y/W/H/∠, opacity, blend | C/P | [src/components/LayersPanel.tsx:117-243](../../src/components/LayersPanel.tsx) |
| — Numeric W/H allows ≥10 px (handles allow ≥50) and does **not** scale the corner-pin offsets, unlike handle resize | B | [src/components/LayersPanel.tsx:216-217](../../src/components/LayersPanel.tsx) vs [src/components/Canvas.tsx:933-945](../../src/components/Canvas.tsx) |
| Blend modes (16) set as `mix-blend-mode` on the frame's inner div | **B (no-op)** | [src/types.ts:5](../../src/types.ts), [src/components/MediaFrame.tsx:488](../../src/components/MediaFrame.tsx) |
| — The wrapper always has `transform: rotate(...)` and `zIndex`, so it forms an isolated stacking context and the blend has nothing beneath it to blend with ([MediaFrame.tsx:464-470](../../src/components/MediaFrame.tsx)). **[runtime]** With the identical structure, `difference` white-on-red rendered pure white (no blend). Without the wrapper stacking context it rendered cyan (blend applied). | B | runtime check |
| CSS filter effects (blur, brightness, contrast, grayscale, saturate, hue, invert, sepia), flip H/V, content zoom/pan | C | [src/components/MediaFrame.tsx:361-395](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:995-1170](../../src/components/MediaFrame.tsx) |
| Multi-select: shift+click, marquee (hit-test uses the **unwarped** rotated AABB), Cmd+A | C/P | [src/components/Canvas.tsx:457-466](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:82-95](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1017-1034](../../src/components/Canvas.tsx) |
| Clipboard: internal only (a ref, not the system clipboard); copy, cut, paste with cascading offset; duplicate | C | [src/components/Canvas.tsx:468-491](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:413-440](../../src/components/Canvas.tsx) |
| Undo/redo: 50 steps, 400 ms debounce; frames, background, composition (not grid or selection) | C | [src/components/Canvas.tsx:34-35](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:332-391](../../src/components/Canvas.tsx) |
| Media library in IndexedDB (50 MB/file and 500 MB total, enforced in app code), thumbnails, filter, upload, delete, clear. Deleting media that frames use gives no warning. | C/P | [src/lib/mediaStorage.ts:8-9](../../src/lib/mediaStorage.ts), [src/lib/mediaStorage.ts:119-164](../../src/lib/mediaStorage.ts), [src/components/MediaLibrary.tsx:109-119](../../src/components/MediaLibrary.tsx) |
| Project: autosave to localStorage (1 s debounce), Save, Export JSON, Export + Media (base64), Import | C/P | [src/components/Canvas.tsx:321-327](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1176-1213](../../src/components/Canvas.tsx), [src/lib/storage.ts:74-198](../../src/lib/storage.ts) |
| PWA: vite-plugin-pwa generateSW, precache, runtime caching of https images and videos | P (see Q5) | [vite.config.ts:10-63](../../vite.config.ts), [src/main.tsx:7-32](../../src/main.tsx) |
| Playback: Play All / Pause All via a 100 ms "pulse" prop; per-frame loop, speed (0.25–3×), mute; muted autoplay. There is no seek, no transport and no sync. The background video is not covered by Play/Pause All. | P | [src/components/Canvas.tsx:224-235](../../src/components/Canvas.tsx), [src/components/MediaFrame.tsx:222-290](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:829-855](../../src/components/MediaFrame.tsx) |
| Presentation mode: same window and same DOM; hides panels; fullscreen on the canvas element; edit/fullscreen buttons on corner hover; ESC exits | P | [src/components/Canvas.tsx:237-266](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1244-1284](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1503-1527](../../src/components/Canvas.tsx) |
| Keyboard shortcuts: P, F, B, G / Shift+G, Del/Backspace, arrows (Shift = grid size or 10 px), Cmd+Z / Shift+Cmd+Z / Cmd+Y, Cmd+C/X/V/D/A, ESC. All README shortcuts exist. | C | [src/components/Canvas.tsx:496-620](../../src/components/Canvas.tsx), [README.md:138-150](../../README.md) |
| Touch: only corner-pin and vertex handles support touch. Frame drag, resize, rotate, draw and marquee are mouse-only (window `mousemove`/`mouseup`). | P | [src/components/MediaFrame.tsx:208-212](../../src/components/MediaFrame.tsx), [src/components/Canvas.tsx:1048-1055](../../src/components/Canvas.tsx) |

**README / TODO claims that the code does not back up**
- "Persistent Storage: Media **and projects** persist … using IndexedDB". Projects are actually stored in localStorage under a single key. The README contradicts itself at line 188. — [README.md:57](../../README.md); [src/lib/storage.ts:3](../../src/lib/storage.ts), [src/lib/storage.ts:90](../../src/lib/storage.ts)
- "Background Sync: Automatic updates available when online". There is no background-sync plugin or code; the workbox config has only precache and runtimeCaching. — [README.md:59](../../README.md); [vite.config.ts:30-59](../../vite.config.ts)
- "Resize using 8 directional handles". Polygons get no resize handles. — [README.md:25](../../README.md); [src/components/MediaFrame.tsx:640](../../src/components/MediaFrame.tsx)
- "Z-index layering control" listed under the hover settings. The hover settings panel has no z-order control; reordering exists only as up/down buttons in the Layers panel. — [README.md:42](../../README.md); [src/components/MediaFrame.tsx:767-992](../../src/components/MediaFrame.tsx); [src/components/LayersPanel.tsx:172-187](../../src/components/LayersPanel.tsx)
- "Corner pin works on every shape … Photoshop-style". Only the rendered outline goes through the homography. Polygon vertex handles and vertex editing ignore it, warp-mode quads use a different mapping, and double-click triangles lose content warping entirely (see Q3). — [README.md:162](../../README.md); [TODO.md:8](../../TODO.md), [TODO.md:11-13](../../TODO.md) claim "resolved"
- "Layers panel … opacity and blend mode". The blend mode is a visual no-op against other layers ([runtime]). — [README.md:169](../../README.md)
- Performance claims are unsupported:
  - "React components are optimized to minimize re-renders": there are 0 uses of `React.memo`/`memo(` in `src`, and inline closures are passed to every frame ([src/components/Canvas.tsx:1367-1384](../../src/components/Canvas.tsx)).
  - "Event Throttling": there is no throttle or `requestAnimationFrame` (0 occurrences); `setFrames` runs on every mousemove ([src/components/Canvas.tsx:853-857](../../src/components/Canvas.tsx)).
  - "Object URLs are properly managed": media blob URLs are never revoked ([src/components/Canvas.tsx:1076](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1115](../../src/components/Canvas.tsx), [src/lib/mediaStorage.ts:249](../../src/lib/mediaStorage.ts)). The only `revokeObjectURL` calls are in thumbnail generation and JSON export.
  - — [README.md:196-202](../../README.md)
- "React 18". package.json pins `react ^19.2.0`. — [README.md:215](../../README.md); [package.json:20-21](../../package.json)
- "Radix UI: Accessible component primitives". Only `react-slot` and `react-slider` are imported. `@radix-ui/react-select` and `react-switch` are unused dependencies, and there are 0 `aria-*` attributes in the src TSX. — [README.md:221](../../README.md); [package.json:13-16](../../package.json); [src/components/ui/button.tsx:2](../../src/components/ui/button.tsx); [src/components/ui/slider.tsx:2](../../src/components/ui/slider.tsx)
- The project structure lists `types/index.ts`, which was deleted in cea802b (now `src/types.ts`). It also omits LayersPanel, TestCard, MediaLibrary, BackgroundSettings and geometry.ts. — [README.md:232-250](../../README.md); `git show --stat cea802b`
- The cea802b commit message says "lint clean". `npm run lint` currently exits 1 (see Q5), although `eslint src` is clean.
- Accurate claims: all keyboard shortcuts; the composition, master and blackout behaviour; undo scope; grid; export with media; the 50/500 MB limits (enforced in app code).

### Inferences
- The project is an "editor-grade prototype": most features work for a single operator in one window. The issues cluster in exactly the area the user flagged (corner pin across shapes) and in compositing (blend modes).
- Because blackout and master only cover pixels ([Canvas.tsx:1338](../../src/components/Canvas.tsx), [Canvas.tsx:1497-1499](../../src/components/Canvas.tsx)), an unmuted frame keeps playing audio during blackout. That is undesirable for live use.

### Gaps
- Real-device behaviour (iOS Safari, Firefox) and projector output were not tested; the runtime checks used desktop Chrome only.
- Video playback with real media files was not exercised at runtime (only test-card frames).

## 2. Rendering architecture and hard limits of the CSS/DOM renderer

### Takeaway
Rendering is pure DOM/CSS:
- a letterboxed, scaled stage `div`;
- one absolutely positioned, rotated wrapper `div` per frame;
- an inner `div` carrying a `clip-path` polygon;
- a `<video>`/`<img>`/SVG content element carrying a `matrix3d` homography, CSS `filter` and a `mask-image` soft edge.

This supports exactly one projective (4-point) warp per frame. It cannot do mesh or bezier warp, per-triangle texture mapping, shaders, working blend modes, synced playback, shared decoding, or a separate output window.

### Cited Findings
- **Stage:** a `div` of `composition.width × height`, transformed with `translate(viewOffset) scale(viewScale)`, where viewScale = min(viewport/composition) (letterbox). Pointer input is mapped back with `toComp`. — [src/components/Canvas.tsx:188-190](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:205-213](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1326-1336](../../src/components/Canvas.tsx)
- **Master fader:** an opacity wrapper around the background and all frames. Grid (z 500), global test card (z 550) and blackout (z 950) are overlays inside the stage. — [src/components/Canvas.tsx:1338-1499](../../src/components/Canvas.tsx)
- **Frame wrapper:** `left/top/width/height` plus `transform: rotate(deg)` (default origin = bbox centre), `zIndex`, `opacity`. — [src/components/MediaFrame.tsx:460-475](../../src/components/MediaFrame.tsx)
- **Inner div:** `clipPath`, `mixBlendMode`, `overflow: visible` when the corner pin is on. In edit mode it also has a 4 px blue `border-4`. — [src/components/MediaFrame.tsx:484-495](../../src/components/MediaFrame.tsx)
- **Content element:** `<video>` (always `muted autoPlay playsInline`), `<img>`, or a TestCard SVG. Style comes from `contentStyle`: absolute 100% box, `transformOrigin: 0 0`, `matrix3d(H)`, then flips, zoom and pan composed after H, plus CSS filter and soft-edge mask. — [src/components/MediaFrame.tsx:377-430](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:496-524](../../src/components/MediaFrame.tsx)
- **Homography maths (`geometry.ts`):**
  - 8×8 Gaussian elimination with partial pivoting; returns `null` if a pivot is below 1e-10. — [src/lib/geometry.ts:11-34](../../src/lib/geometry.ts)
  - `computeHomography(src, dst)` from 4 point pairs. — [src/lib/geometry.ts:45-64](../../src/lib/geometry.ts)
  - Embedding into a column-major `matrix3d`. — [src/lib/geometry.ts:77-80](../../src/lib/geometry.ts)
  - `getPerspectiveHomography` maps the rect `(0,0)-(w,h)` onto the bbox corners plus their pixel offsets. — [src/lib/geometry.ts:96-114](../../src/lib/geometry.ts)
  - Shapes become normalised vertex lists; a circle is a 48-gon. — [src/lib/geometry.ts:162-185](../../src/lib/geometry.ts)
  - There is **no inverse-homography helper**.
- **"Unified warp model" (MediaFrame.tsx:305-357):**
  1. `perspH` = bbox homography when `perspectiveMode`.
  2. `shapeVerticesPx` = shape vertices × (w,h), pushed through `perspH`.
  3. `contentH` = `perspH`, except that 4-vertex polygons in `warp` mode get rect→`shapeVerticesPx`.
  4. When the pin is on, the clip-path is `polygon(shapeVerticesPx in px)` on the inner div. When it is off: circle = `ellipse(50% 50%)`, polygon = percent `polygon()`, rect = `none`.
  — [src/components/MediaFrame.tsx:305-357](../../src/components/MediaFrame.tsx)
- **Warped editing grid:** 8 divisions, line endpoints mapped through `contentH ?? perspH`, rendered as SVG lines. — [src/components/MediaFrame.tsx:55-56](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:437-452](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:541-559](../../src/components/MediaFrame.tsx)
- **Video decoding:** each visible frame with a video URL renders its own `<video>` element. The background adds one more. The same file used in N frames means N independent elements, with no shared clock and no `requestVideoFrameCallback`. — [src/components/MediaFrame.tsx:505-515](../../src/components/MediaFrame.tsx), [src/components/Canvas.tsx:1355-1363](../../src/components/Canvas.tsx), [src/components/MediaFrame.tsx:236-290](../../src/components/MediaFrame.tsx)
- The README itself advises "Limit simultaneous videos to 5-10". — [README.md:209](../../README.md)
- **No output-routing, GPU or capture APIs:** a grep of `src/` for `window.open`, `BroadcastChannel`, `getScreenDetails`, `getUserMedia`, `getDisplayMedia`, `requestMIDIAccess`, `AudioContext`, `WebSocket`, `webgl`/`WebGL`, `captureStream`, `MediaRecorder` and `navigator.storage` returned 0 matches. — [build/grep 2026-10-15]
- **Blend-mode isolation ([runtime]):** a wrapper with `transform` and `z-index` isolates the child's `mix-blend-mode`. The test rendered white (no blend); the control without the wrapper rendered cyan (difference). This matches the structure at [src/components/MediaFrame.tsx:464-470](../../src/components/MediaFrame.tsx) and [src/components/MediaFrame.tsx:488](../../src/components/MediaFrame.tsx).
- **Editor ≠ output by 4 px ([runtime]):**
  - Inner div: `border-top-width: 4px`, `box-sizing: border-box` ([src/index.css:5-7](../../src/index.css), [src/components/MediaFrame.tsx:485](../../src/components/MediaFrame.tsx)).
  - The content element measured `offsetWidth × offsetHeight = 316×262` inside a `324×270` wrapper. The homography assumes a full w×h source at (0,0), while the clip-path, corner handles and orange outline use full frame-local coordinates.
  - [numeric] With pins tl(60,40) and tr(−30,20) on a 400×300 frame, the content's top-right corner lands at (367.3, 24.4) while the TR pin handle sits at (370.0, 20.0).
  - The border is removed in presentation mode ([MediaFrame.tsx:485](../../src/components/MediaFrame.tsx)), so the final output is correct.

### Inferences
- **Hard limits of this renderer:**
  - (a) Only projective maps of a rectangle: no mesh, bezier or grid warp. TODO.md acknowledges this: "The current CSS renderer covers projective quads only" ([TODO.md:16](../../TODO.md)).
  - (b) No per-triangle or per-polygon texture mapping.
  - (c) No custom shaders; effects are limited to the CSS filter list.
  - (d) Blend modes cannot blend across frames unless the frame wrapper itself carries `mix-blend-mode` and nothing between it and the stage isolates it.
  - (e) Soft edges are linear alpha ramps in bbox space with no gamma or black-level control (real projector blending needs gamma-shaped ramps).
  - (f) The browser compositor controls resampling and filtering of `matrix3d` layers; strong keystone can alias or blur.
  - (g) A corner drag that makes the quad non-convex (w ≤ 0 for some pixels) is not prevented ([MediaFrame.tsx:182-194](../../src/components/MediaFrame.tsx) has no validation), and `matrix3d` then renders folded or garbage geometry.
  - (h) Each `<video>` is decoded independently; frames drift, and the same clip on several surfaces costs several decodes.
  - (i) Output is the editor window (fullscreen), so there is no second-display output with a separate operator UI.
  - (j) Every visual change goes through React reconciliation of the whole canvas; there is no render loop.
- A WebGL/WebGPU compositor (as TODO.md:16 proposes) would lift (a)–(g) and enable a single decode per clip shared across surfaces. Cross-origin URL media without CORS headers cannot be uploaded as WebGL textures (tainted). Today's URL-based media therefore may not carry over to a GPU renderer as-is.

### Gaps
- No GPU or frame-time profiling was done (no FPS measurements with N videos), so the practical video ceiling on target hardware is unknown.
- The non-convex `matrix3d` behaviour (g) was not tested visually.

## 3. Open issue: corner pins behave differently per shape (TODO.md uncommitted note vs "resolved" claim)

### Takeaway
The claim that this was "resolved" in cea802b is only half true. The *rendering* now pushes every shape's outline through the same bbox homography. The behaviour still diverges by shape in nine concrete ways:
1. Pins are anchored to the frame's bounding box, not to the shape.
2. Polygons have no resize handles but do have vertex handles.
3. Vertex handles are drawn and edited in un-warped space (31.8 px off in a test case).
4. Warp-mode quads use a second, vertex-based mapping that depends on vertex order.
5. Warp mode silently falls back to clip for triangles and n-gons.
6. A triangle closed by double-click becomes a degenerate quad whose content loses the corner-pin warp entirely (verified at runtime).
7. Soft edges, selection border and labels stay rectangular.
8. A 4 px editor border offsets the content.
9. Numeric resize does not scale the pins.

### Cited Findings
- **The uncommitted note** (`git diff TODO.md`, TODO.md line 2): "Please first research why every corner pin of the frame (square, triangle, polygon ..) is treated differently … it should work like in photoshop … (e.g. the shape stays but it is warped inside)". The same file still lists "Unified corner pin … for every shape (rectangle, circle, polygon, triangle)" as Done and the research notes as "(resolved)". — [TODO.md:2](../../TODO.md), [TODO.md:8](../../TODO.md), [TODO.md:11-13](../../TODO.md)
- **Pin reference = frame bbox for all shapes.** Corners are pixel offsets from `(0,0)`, `(w,0)`, `(w,h)`, `(0,h)`. — [src/types.ts:9-16](../../src/types.ts), [src/lib/geometry.ts:96-114](../../src/lib/geometry.ts), [src/components/MediaFrame.tsx:188-191](../../src/components/MediaFrame.tsx)
  - Rectangle: bbox = shape, so the pins sit on the shape's corners.
  - Circle and polygon: pins sit on bbox corners.
  - A polygon's bbox is the tight AABB of the clicked points at creation, with vertices normalised to it ([src/components/Canvas.tsx:633-653](../../src/components/Canvas.tsx)). It is never re-fitted after vertex edits; vertices are clamped to [0,1] ([src/components/MediaFrame.tsx:173-174](../../src/components/MediaFrame.tsx)).
  - [numeric] For the triangle (0.5,0),(1,1),(0,1), pins BR and BL coincide with vertices while TL and TR float in empty space.
- **Different handle sets per shape:**
  - rect/circle: 8 yellow resize handles, with the corner ones pushed to −26 px in pin mode ([src/components/MediaFrame.tsx:640-650](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:1177-1193](../../src/components/MediaFrame.tsx)), plus 4 orange pins.
  - polygon/triangle: no resize handles; purple vertex handles plus 4 orange pins ([src/components/MediaFrame.tsx:653-673](../../src/components/MediaFrame.tsx)).
  - Rotation handle: always at the un-warped bbox top-centre ([src/components/MediaFrame.tsx:676-686](../../src/components/MediaFrame.tsx)).
- **Vertex handles ignore the homography.**
  - Handles are positioned at `vertex.x * width, vertex.y * height` ([src/components/MediaFrame.tsx:658-659](../../src/components/MediaFrame.tsx)), but the outline is drawn from `shapeVerticesPx` = H(vertex) ([src/components/MediaFrame.tsx:326-330](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:591-601](../../src/components/MediaFrame.tsx)).
  - Vertex drag writes the pointer's local position directly as the pre-warp vertex, with no inverse H ([src/components/MediaFrame.tsx:166-179](../../src/components/MediaFrame.tsx)).
  - [numeric] With pins tl(60,40) and tr(−30,20) on 400×300, the apex handle is drawn at (200,0) but the rendered apex is at (209.3,30.4): 31.8 px apart. Dragging a vertex therefore moves it to H(pointer), not under the cursor.
  - The dashed purple polygon outline is hidden in pin mode ([src/components/MediaFrame.tsx:562](../../src/components/MediaFrame.tsx)), but the handles are not.
- **Content mapping differs by shape and texture mode** ([src/components/MediaFrame.tsx:332-342](../../src/components/MediaFrame.tsx)):
  - rect, circle, clip-polygon and triangle: `contentH = perspH`. Media fills the bbox, is warped by the pins and clipped by H(shape). This is the "shape stays, warped inside" behaviour the user wants.
  - 4-vertex polygon in `warp` mode: `contentH` = rect → H(vertices). The vertices act as a second set of pins composed with the bbox pins.
  - 3 or ≥5 vertices in warp mode: silent fallback to clip ([src/components/MediaFrame.tsx:912-918](../../src/components/MediaFrame.tsx)).
- **Warp quads depend on vertex order.** `shapeVerticesPx.slice(0,4)` is mapped to TL, TR, BR, BL in click order ([src/components/MediaFrame.tsx:340](../../src/components/MediaFrame.tsx); click order from [src/components/Canvas.tsx:650-653](../../src/components/Canvas.tsx)). [numeric] A counter-clockwise quad gives a linear-part determinant of −1.00 (mirrored media). A clockwise quad starting at BR maps the media's TL to (400,300) (rotated 180°).
- **Degenerate quad kills the content warp.**
  - If `computeHomography` returns `null`, `contentH` becomes `null`, overwriting `perspH`. There is no fallback ([src/components/MediaFrame.tsx:336-342](../../src/components/MediaFrame.tsx); null path [src/lib/geometry.ts:23](../../src/lib/geometry.ts)).
  - [numeric] rect→[A,B,C,C] (the double-click triangle) returns `null`.
  - **[runtime]** On a double-click triangle with `warp` mode and pins tl(60,40), tr(−30,20): the inner clip-path was `polygon(0px 269.663px, 171.924px 30.4173px, 323.596px 269.663px, 323.596px 269.663px)` (warped), but the content `transform` was empty (unwarped). The identical frame in `clip` mode got `matrix3d(0.649194, -0.0667566, …)`. The screenshot showed an unwarped test card cut by a warped triangle.
- **Circle switches representation:** exact `ellipse()` when the pin is off, a 48-gon when it is on (even with zero offsets). — [src/components/MediaFrame.tsx:345-357](../../src/components/MediaFrame.tsx), [src/lib/geometry.ts:161-177](../../src/lib/geometry.ts)
- **Soft edge always follows the 4 bbox edges** (a mask in content space), never triangle, polygon or circle edges. Only warp-quads get feathering along the shape edges, because there the content is mapped onto the quad. — [src/components/MediaFrame.tsx:397-406](../../src/components/MediaFrame.tsx)
- **Unwarped rectangular overlays inside the warped clip:** selection border ([src/components/MediaFrame.tsx:582-584](../../src/components/MediaFrame.tsx)), filename bar ([src/components/MediaFrame.tsx:575-579](../../src/components/MediaFrame.tsx)) and the 4 px editor border ([src/components/MediaFrame.tsx:485](../../src/components/MediaFrame.tsx)). For polygons they show only where the shape touches the bbox.
- **Numeric W/H** in the Layers panel does not rescale `perspectiveCorners` (offsets are absolute px), while handle resize does. — [src/components/LayersPanel.tsx:216-217](../../src/components/LayersPanel.tsx) vs [src/components/Canvas.tsx:933-945](../../src/components/Canvas.tsx)
- **Rotation composes correctly** for all shapes. Pin drag converts the pointer into unrotated local space; snapping uses the composition grid only when the frame is unrotated. — [src/components/MediaFrame.tsx:141-154](../../src/components/MediaFrame.tsx), [src/lib/geometry.ts:146-155](../../src/lib/geometry.ts)
- **Marquee hit-testing** uses the un-warped rotated AABB, so pins dragged outside the box are not considered. — [src/components/Canvas.tsx:82-95](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1024-1030](../../src/components/Canvas.tsx)

### Inferences
- **Root cause:** three deformation models coexist with no single source of truth:
  - (1) frame-level corner pins in bbox space;
  - (2) polygon vertices in pre-warp normalised space;
  - (3) "warp" texture mode, where the vertices themselves become pins.
  On top of that, the UI computes handle positions per shape in different spaces (pins warped, vertices unwarped) and shows different handle sets (resize vs vertex).
- **Candidate fix A: a Photoshop-style single envelope that works in the current CSS renderer.**
  - Keep one homography H per frame, defined by 4 pins on the frame's AABB.
  - Re-fit the AABB to the vertices after every vertex edit, re-normalising the vertices and adjusting x/y/w/h so absolute positions are unchanged.
  - Push *everything* through H: content corners, shape vertices, vertex handles, warp grid, selection outline (replace the CSS border with the warped SVG outline), and hit-testing/marquee via H(bbox).
  - Add `invertHomography` (a 3×3 inverse) and use H⁻¹ when dragging vertices, so a vertex stays under the cursor.
  - Give polygons the same 8 resize handles: normalised vertices scale for free.
  - Make the numeric W/H path call the same scale-pins logic as handle resize.
  - Remove the 4 px border from the content box (draw the editor outline as an overlay) so the editor matches the output.
  - This exactly implements "the shape stays but it is warped inside" for rect, circle, triangle and polygon.
- **Candidate fix B: clean up warp mode.**
  - Either drop `warp` for quads (equivalent to placing the pins on the quad vertices), or make it an explicit "pin to vertices" action: copy the 4 vertices into `perspectiveCorners` and reset the vertices to the unit square.
  - If kept, canonicalise vertex order (use the signed area to force clockwise; rotate so the vertex nearest the bbox TL comes first).
  - Fall back to `perspH` when `computeHomography` returns null.
  - Fix polygon closing: ignore mousedowns with `e.detail >= 2`, and/or de-duplicate consecutive vertices within ε in `finishPolygon` ([src/components/Canvas.tsx:627-673](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:699-714](../../src/components/Canvas.tsx)).
- **Candidate fix C: "texture follows the shape" for triangles and n-gons** (content stretched to the shape, not just clipped). This needs piecewise mapping:
  - Triangulate (ear clipping) and map each triangle affinely (3 point pairs). In CSS that means one clipped copy of the media element per triangle (n−2 decodes, visible seams), or a 2D-canvas `setTransform` + `clip` per triangle.
  - The robust route is WebGL: one video texture, a mesh with UVs, and perspective-correct (homogeneous) UVs for quads to avoid the diagonal "kink" of two affine triangles. The same mesh enables grid/bezier mesh warp, which is what Photoshop's *Warp* (as opposed to *Perspective/Distort*) does.
- **Recommended sequencing:** do Fix A and the bug fixes from B immediately; they are cheap, stay in the CSS renderer, and cover the user's expectation. Fix C belongs to the WebGL renderer milestone already listed in TODO.md ([TODO.md:16](../../TODO.md)).

### Gaps
- The user's exact reproduction (which shapes, closing method, texture mode) is not recorded. The analysis covers all code paths, but which divergence the user saw is inferred.
- Photoshop's exact Free Transform semantics are described from general knowledge, not verified against Adobe documentation in this audit.

## 4. State management and persistence

### Takeaway
All application state lives in `useState` hooks inside one 1,541-line `Canvas` component. There is no store or context, and props are drilled. Undo/redo is a debounced snapshot stack in a ref. Projects persist to a single localStorage key with a version string that is written but never read. Media lives in IndexedDB. There is no schema validation, no real migrations, no multi-project support, and no protection against storage eviction.

### Cited Findings
- **State inventory:** frames, selection, drag/resize/rotate/draw/polygon/marquee gesture state, draw mode, pending media, media-library targeting, background, grid, composition, panel visibility, playback pulse, master/blackout/test card, load flag and viewport are all `useState` in `Canvas`. Refs hold the clipboard and history. — [src/components/Canvas.tsx:98-183](../../src/components/Canvas.tsx)
- `MediaFrame` holds local UI state (hover panels) and its own vertex/pin drag state. Each frame instance registers 4 window listeners (mousemove, mouseup, touchmove, touchend). — [src/components/MediaFrame.tsx:73-220](../../src/components/MediaFrame.tsx)
- **Undo/redo:**
  - On every change to `frames`/`background`/`composition` (after load), a 400 ms debounce pushes the previous snapshot to `past` (limit 50) and clears `future`.
  - `undo` first commits any pending change. `applying` suppresses recording while restoring.
  - Snapshots are references to immutable state (structural sharing).
  - History is not persisted; grid and selection are excluded.
  — [src/components/Canvas.tsx:27-35](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:332-391](../../src/components/Canvas.tsx)
- **localStorage project:**
  - Key `video-mapper-project`. `VERSION = '4.0.0'` is written on save and export, but `loadProject`/`importProject` never read it.
  - "Migration" is just `migrateFrame` filling defaults with `??`.
  - Blob URLs are stripped for frames with `mediaId` and re-resolved from IndexedDB on load.
  - `saveProject` re-throws on failure.
  — [src/lib/storage.ts:3-4](../../src/lib/storage.ts), [src/lib/storage.ts:23-46](../../src/lib/storage.ts), [src/lib/storage.ts:55-72](../../src/lib/storage.ts), [src/lib/storage.ts:74-125](../../src/lib/storage.ts)
- **Autosave** is debounced 1 s and gated on `isProjectLoaded`. The `saveProject` call inside `setTimeout` has no try/catch. — [src/components/Canvas.tsx:321-327](../../src/components/Canvas.tsx)
- **Import** validates only that `frames` is an array. All other fields are trusted (`JSON.parse` result typed as any). — [src/lib/storage.ts:165-198](../../src/lib/storage.ts)
- **IndexedDB:**
  - DB `video-mapper-media` v1, one store `media` (keyPath `id`; indexes name, type, dateAdded); records hold the Blob plus a base64 JPEG thumbnail.
  - Limits of 50 MB/file and 500 MB total are enforced in app code. The total is computed with `getAll()` over all records on every `storeMedia`.
  — [src/lib/mediaStorage.ts:3-45](../../src/lib/mediaStorage.ts), [src/lib/mediaStorage.ts:119-164](../../src/lib/mediaStorage.ts), [src/lib/mediaStorage.ts:233-241](../../src/lib/mediaStorage.ts)
- There is no `navigator.storage.persist()` or `estimate()` call (0 matches for `persist()`, `estimate()` or `QuotaExceeded` in src). — [build/grep 2026-10-15]
- **Export + Media** base64-encodes every referenced blob into one JSON string built in memory (`JSON.stringify(..., null, 2)`). Import fetches each data URL back into a Blob and keeps the original ids. — [src/lib/mediaStorage.ts:285-342](../../src/lib/mediaStorage.ts), [src/lib/storage.ts:127-163](../../src/lib/storage.ts), [src/components/Canvas.tsx:1186-1213](../../src/components/Canvas.tsx)
- Deleting a library item gives no reference check against frames. — [src/components/MediaLibrary.tsx:109-130](../../src/components/MediaLibrary.tsx)
- **Unused state:** `mediaUrlCache` (the value is never read; only the setter is used) and `backgroundVideoRef` (never read). — [src/components/Canvas.tsx:155](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:174](../../src/components/Canvas.tsx)

### Inferences
- There is a single project slot: no "Save As", no scenes or cues, no backups. A bad autosave (for example, after an accidental "Clear") overwrites the only copy.
- A failing autosave (such as hitting the ~5 MB localStorage quota if a user pastes a `data:` URL via "Add from URL") throws inside a timer and goes unnoticed.
- Without `persist()`, IndexedDB is best-effort storage, and browsers may evict the media library under disk pressure. Projects would then reload with empty frames. This is risky for a show machine.
- Base64 export inflates media by about 33% and builds one giant string. Near the 500 MB library cap it would likely exceed V8's maximum string length (about 2^29 characters), so large exports would fail. A zip/OPFS/File System Access based package format would scale better.
- Media referenced only by URL (not in the library) is not embedded on export, so "portable" projects are only portable for library media.
- The flat `frames[]` model (one media per frame) has no notion of clips, decks, layers containing clips, or input→output slices. This is the main schema change a VJ tool would need. Combined with the unread version string, a versioned schema plus a migration pipeline should precede any schema growth.

### Gaps
- Actual localStorage and IndexedDB quotas on the target browsers were not measured.
- The behaviour of undo during very slow drags (pauses longer than 400 ms create several entries) was inferred from the debounce logic, not tested.

## 5. Code health: build, lint, size, tests, types, performance, a11y, errors, security

### Takeaway
- TypeScript strict-mode build passes and the bundle is small (330 KB JS / 102 KB gzip).
- `npm run lint` **fails** (14 problems), but only because generated `dev-dist/` is not ignored; `src` lints clean.
- There are zero tests, two god components (1,541 and 1,193 lines), whole-tree re-renders per mousemove, leaked blob URLs, no accessibility attributes, `alert`/`confirm`-based UX, and a double service-worker registration that produced blocking dialogs in the runtime test.

### Cited Findings
- **Build ([build]):**
  - `npx tsc -b` exits 0.
  - `vite build` (v7.3.0): 1,735 modules, built in 1.52 s.
  - `index-CEFrZa46.js` 330.24 kB (gzip 102.14 kB); `index-DhaeFwGC.css` 25.57 kB (gzip 5.23 kB).
  - PWA precache: 8 entries, 352.43 KiB.
  - Warning: "Browserslist: browsers data (caniuse-lite) is 10 months old".
  - The hashes match the existing local `dist/` (gitignored), so the deployed build likely matches the source.
- **Lint ([build]):**
  - `npm run lint` → exit 1: **14 problems (10 errors, 4 warnings)**, all in the generated `dev-dist/workbox-d93339a4.js`. They are "Definition for rule '@typescript-eslint/ban-types' / 'no-unsafe-*' was not found" plus unused eslint-disable directives.
  - Cause: `globalIgnores(['dist'])` does not cover `dev-dist`, which `npm run dev` regenerates because `devOptions.enabled: true`.
  - `npx eslint src` → 0 problems.
  - — [eslint.config.js:9](../../eslint.config.js), [vite.config.ts:60-62](../../vite.config.ts), [.gitignore:26](../../.gitignore)
- **Size:** Canvas.tsx 1,541; MediaFrame.tsx 1,193; ControlPanel.tsx 534; mediaStorage.ts 355; MediaLibrary.tsx 345; LayersPanel.tsx 257; storage.ts 203; types.ts 191; BackgroundSettings.tsx 187; geometry.ts 185; TestCard.tsx 73; ui/* 107. Total 5,265 (`wc -l`). Canvas.tsx mixes view math, gestures, keyboard, history, persistence, media and the render tree in one component. — [src/components/Canvas.tsx](../../src/components/Canvas.tsx)
- **Tests:** none. There are no `*.test.*`/`*.spec.*` files, no `test` script and no test dependencies. — [package.json:6-11](../../package.json), [package.json:24-41](../../package.json)
- **Type safety:**
  - `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` are on ([tsconfig.app.json:26-31](../../tsconfig.app.json)).
  - Weak spots: untyped `JSON.parse` results flow into `MediaFrame[]` ([src/lib/storage.ts:111](../../src/lib/storage.ts), [src/lib/storage.ts:172](../../src/lib/storage.ts)); non-null assertions in history ([src/components/Canvas.tsx:348](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:371](../../src/components/Canvas.tsx)); string casts such as `handle as ResizeState['handle']` ([src/components/Canvas.tsx:805](../../src/components/Canvas.tsx)).
- **Performance hazards:**
  - Every pointer move during drag, resize or rotate calls `setFrames`, re-rendering `Canvas` and all `MediaFrameComponent`s. There is no memo (0 uses), new inline callbacks per frame per render, and homography and clip strings are recomputed for every frame. — [src/components/Canvas.tsx:853-857](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:947](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1367-1384](../../src/components/Canvas.tsx)
  - Window mouse listeners are torn down and re-added whenever `handleMouseMove`'s deps change (they include `frames`, so on every update). The keyboard listener is likewise re-bound on every frames change. — [src/components/Canvas.tsx:973](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1048-1055](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:615-620](../../src/components/Canvas.tsx)
  - Each frame adds 4 window listeners. — [src/components/MediaFrame.tsx:209-212](../../src/components/MediaFrame.tsx)
  - `getStorageStats` calls `getAll()` over all media on each store. — [src/lib/mediaStorage.ts:130](../../src/lib/mediaStorage.ts), [src/lib/mediaStorage.ts:233-241](../../src/lib/mediaStorage.ts)
  - Blob URLs are created and never revoked on drop, library select and load. — [src/components/Canvas.tsx:1076](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1115](../../src/components/Canvas.tsx), [src/lib/mediaStorage.ts:249](../../src/lib/mediaStorage.ts)
- **Accessibility:**
  - 0 `aria-*` and 0 `role=` in the src TSX; icon-only buttons rely on `title`.
  - Frame controls appear on mouse hover only. — [src/components/MediaFrame.tsx:292-299](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:689-764](../../src/components/MediaFrame.tsx)
  - Handles are non-focusable divs. — [src/components/MediaFrame.tsx:604-673](../../src/components/MediaFrame.tsx)
- **Error handling:**
  - 8 `alert()`/`confirm()` calls and 13 `console.*` calls; no React ErrorBoundary.
  - Save shows "Project saved!" via `alert` ([src/components/Canvas.tsx:1178](../../src/components/Canvas.tsx)). Import and export errors use `alert` ([src/components/Canvas.tsx:1195](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1209-1211](../../src/components/Canvas.tsx)).
  - The SW update prompt is a blocking `confirm('New version available. Reload to update?')`. — [src/main.tsx:21](../../src/main.tsx)
- **Double SW registration and two manifests:**
  - The built `index.html` contains both `<link rel="manifest" href="/manifest.json">` (from [index.html:21](../../index.html)) and the generated `<link rel="manifest" href="/manifest.webmanifest">`.
  - It also includes the plugin's `registerSW.js`, while `main.tsx` additionally registers `/sw.js` with `{type:'module'}` ([src/main.tsx:7-12](../../src/main.tsx)). — `dist/index.html` [build]
  - **[runtime]** During the preview test, a blocking JS dialog appeared on first load and again on reload, stalling page scripts until dismissed. The dialog text was not captured.
- **Security / input handling:**
  - "Add from URL" accepts any string with no scheme allow-list. — [src/components/ControlPanel.tsx:100-106](../../src/components/ControlPanel.tsx), [src/components/Canvas.tsx:1107-1111](../../src/components/Canvas.tsx)
  - Imported JSON is not schema-validated. — [src/lib/storage.ts:174-186](../../src/lib/storage.ts)
  - There is no CSP in `index.html`. — [index.html:1-27](../../index.html)
  - Runtime caching is `CacheFirst` for any `https://*.mp4|webm|ogg` with `statuses: [0, 200]` (opaque responses cached). — [vite.config.ts:44-57](../../vite.config.ts)
- **Dead code and unused dependencies:** `@radix-ui/react-select`, `@radix-ui/react-switch` and `src/assets/react.svg` are unused. — [package.json:13](../../package.json), [package.json:16](../../package.json)

### Inferences
- The dialogs seen at runtime are most plausibly the `confirm()` at [src/main.tsx:21](../../src/main.tsx). The second `register('/sw.js', {type:'module'})`, with a different script type from the plugin's registration, likely triggers an `updatefound` while a controller exists. A modal dialog on the projector during a show is a release blocker; registration should be left to vite-plugin-pwa, with an in-app toast.
- React escaping means XSS risk is low. The realistic risks are robustness ones: malformed imports producing NaN geometry or crashes (with no ErrorBoundary, a blank output) and tracking pixels via arbitrary URLs.
- Caching opaque video responses with CacheFirst can fill storage and, without Workbox's range-request handling, can break seeking for cached videos (Workbox normally needs a RangeRequests plugin for media). This was not tested.
- For live performance, the per-mousemove full re-render will degrade with many video frames. Moving gesture state into refs plus `requestAnimationFrame`, memoising frames, or moving output rendering to a canvas/GL loop would decouple editor interactions from output smoothness.

### Gaps
- No runtime profiling (React Profiler, Chrome Performance) was performed, so the re-render cost is inferred from code, not measured.
- The dialog text from the runtime test was not captured, so attributing it to the SW confirm is an inference.

## 6. Missing production-critical capabilities for a VJ / projection-mapping tool

### Takeaway
None of the live-performance infrastructure exists:
- no separate output window or multi-display;
- no MIDI, OSC or remote control;
- no BPM or audio reactivity;
- no shader effects, clip decks, triggering, transitions or crossfader;
- no timeline or cues, recording, or live inputs;
- no crash recovery beyond a single localStorage autosave;
- no versioned schema in practice.

The data model (one media item per frame) is itself a blocker for decks and clip triggering.

### Cited Findings
- **Output:** "Present" toggles chrome off in the same window and requests fullscreen on the canvas. There is no `window.open`, `BroadcastChannel` or Window Management API (`getScreenDetails`) anywhere, so there is no second-screen output with an operator UI. — [src/components/Canvas.tsx:237-266](../../src/components/Canvas.tsx), [src/components/Canvas.tsx:1244-1284](../../src/components/Canvas.tsx); [grep 2026-10-15]
- **Control protocols:** no `requestMIDIAccess`, `WebSocket` (OSC bridge), or keyboard-to-parameter mapping. Shortcuts are hard-coded. — [src/components/Canvas.tsx:496-620](../../src/components/Canvas.tsx); [grep]
- **Audio/BPM:** no `AudioContext`, analyser or tap tempo. — [grep]
- **Effects:** only CSS filters ([src/components/MediaFrame.tsx:361-371](../../src/components/MediaFrame.tsx)); no WebGL. Blend modes are non-functional across layers (Q1/Q2).
- **Clips/decks/triggering/transitions:** `MediaFrame` has exactly one `url`/`mediaId` and no clip list, deck, column, transition or crossfade fields. Playback control is only global play/pause. — [src/types.ts:85-131](../../src/types.ts), [src/components/Canvas.tsx:224-235](../../src/components/Canvas.tsx)
- **Timeline/cues:** absent. README and TODO list it as future work. — [README.md:264](../../README.md), [TODO.md:18](../../TODO.md)
- **Recording/export as video:** no `MediaRecorder`/`captureStream`. Listed as future. — [README.md:266](../../README.md), [TODO.md:19](../../TODO.md); [grep]
- **Live inputs:** no `getUserMedia` (webcam/capture card) or `getDisplayMedia` (screen). NDI has no browser API. — [grep]
- **Input/output separation:** no notion of slicing a shared composition across surfaces (Resolume "input selection → output slice"). Each frame plays its own media; spanning one video across several surfaces needs N unsynced decodes plus per-frame zoom/pan. — [src/components/MediaFrame.tsx:373-395](../../src/components/MediaFrame.tsx), [src/components/MediaFrame.tsx:505-515](../../src/components/MediaFrame.tsx)
- **Crash recovery / project management:** a single autosave slot with no history or backups; undo is not persisted. `version` is written but unused. — [src/lib/storage.ts:3-4](../../src/lib/storage.ts), [src/lib/storage.ts:106-125](../../src/lib/storage.ts), [src/components/Canvas.tsx:177-183](../../src/components/Canvas.tsx)
- **Mapping tools still missing** (from TODO "Next candidates"): mesh warp beyond 4 corners, bezier mask edges, numeric corner-pin entry. — [TODO.md:15-20](../../TODO.md)
- **Other gaps visible in code:**
  - No per-frame lock or "safe" mode against accidental edits during a show.
  - The presentation-mode exit and fullscreen buttons appear on corner hover. — [src/components/Canvas.tsx:1313-1323](../../src/components/Canvas.tsx)
  - Blackout and master do not mute audio. — [src/components/Canvas.tsx:1497-1499](../../src/components/Canvas.tsx)
  - Composition changes do not rescale mappings. — [src/components/Canvas.tsx:1263](../../src/components/Canvas.tsx)
  - Edit gestures are mouse-only. — [src/components/Canvas.tsx:1048-1055](../../src/components/Canvas.tsx)

### Inferences
- **Prioritised path to "production-ready"** (inferred from the gaps above):
  - (0) Fix the release blockers: the SW `confirm` and double registration, blend-mode isolation (move `mix-blend-mode` to the wrapper or render frames into a non-isolated layer), the corner-pin/vertex unification and polygon de-duplication (Q3), the lint config, and a baseline test suite for `geometry.ts` and `storage.ts`.
  - (1) A versioned project schema with migrations and validation (for example zod), multiple projects, backups, and `navigator.storage.persist()`.
  - (2) An output window (`window.open` + `BroadcastChannel`/shared state; Window Management API for screen placement), separating operator UI from output.
  - (3) A renderer abstraction with a WebGL/WebGPU compositor: shared video textures, mesh warp, shader FX, real blend modes, gamma soft edges, input→output slices.
  - (4) A clip/deck model with triggering, transitions and crossfader, then MIDI (Web MIDI) and OSC (via WebSocket bridge) mapping, then BPM/audio analysis.
  - (5) Live inputs via getUserMedia/getDisplayMedia, and recording via `canvas.captureStream` + MediaRecorder once a canvas renderer exists.
- **Browser platform constraints for the roadmap** (to be verified by other researchers):
  - Web MIDI and the Window Management API are Chromium-centric.
  - NDI requires a native bridge.
  - Cross-origin URL media needs CORS to become a WebGL texture.

### Gaps
- Browser support levels for Web MIDI, the Window Management API, WebGPU and `requestVideoFrameCallback` as of 2026 were not researched (out of scope for a codebase audit).
- The intended target hardware and browsers (dedicated show PC vs tablet) are not documented in the repo, which affects which gaps are critical.
