
Looks like we got an issue here. Please first research why every corner pin of the frame (square, triangle, polygon ..) is treated differently. This is a problem for perspective warping. I think it should work like in photoshop. Find out what would be possible solutions even for polygon or triangles (e.g. the shape stays but it is warped inside)

> **Update 2026-10-15 — addressed (Phase 0).** Root cause: three competing deformation models (frame pins on the box, polygon vertices in unwarped space, and a second homography in "warp" texture mode), with handles drawn in different spaces. Now there is one homography per frame and everything goes through it — content, clip shape, grid, vertex/resize handles, selection outline and hit area. Vertex drags use H⁻¹ (vertex stays under the cursor) and the box refits afterwards; polygons get resize handles; folded pin quads are rejected; the old warp mode became "Stretch media onto quad" (pins on the quad's vertices, old projects migrate). Polygons with corner pin toggle between pin and vertex editing by double-click. True piecewise/mesh texture mapping onto triangles needs the GPU renderer (roadmap Phase 3).

# TODO

## Done
- [x] Add a grid for mapping — grid overlay + snap-to-grid, G / Shift+G shortcuts, size selector, optional visibility in present mode. Settings persist with the project.
- [x] Unified corner pin (the research item below) — the shape now warps through the same homography as the content for every shape (rectangle, circle, polygon, triangle). Polygon "warp" texture mode works for quads. A warped editing grid shows during corner-pin editing, and corner handles snap to the canvas grid.
- [x] Fixed composition resolution (Resolume model), undo/redo, multi-select + marquee + clipboard, rotation-aware resize, layers panel with numeric properties, soft edge masks, per-frame + global test patterns, master fader + blackout (B), export with embedded media.
- [x] Phase 0 stabilization — single-homography corner pin for all shapes (see update above), working blend modes (blend on the frame's stacking context), editor overlay layer (handles/outlines/hit areas never blend or clip), polygon double-click fix, convex-pin guard, one service-worker registration with a non-blocking update notice, autosave error notice, crash fallback (black output), blackout/master also mute audio, persistent-storage request, media-delete usage warning, one object URL per media, lint fixed, Vitest unit tests, CI workflow, README corrected.

## Corner-pin research notes (resolved)

The old inconsistency: the homography (`matrix3d`) and the shape (`clip-path`) were applied to the same element, so enabling corner pin replaced the shape clip with the quad. Now the content element gets the homography and the *wrapper* gets a clip-path whose vertices are transformed through the same homography (straight edges stay straight under a homography; circles are approximated as 48-gons when warped). See `src/lib/geometry.ts` and the "Unified warp model" block in `src/components/MediaFrame.tsx`.

## Phase 1 progress (branch feat/phase-1-foundation)
- [x] 1.1 Project + live state in zustand stores, history module, memoized frames
- [x] 1.2 Validated, versioned project format (zod) with migration chain; unreadable autosaves are backed up
- [x] 1.7 Output window (BroadcastChannel sync, screen selection via Window Management API, wake lock, cursor hiding)
- [x] 1.6 Video benchmark page (`?benchmark`) — still needs real runs on show hardware: in the automated test browser rAF fell to ~35 fps as soon as 2 videos played, independent of codec and CSS warp (likely an artifact of that browser instance, unconfirmed)
- [x] 1.3 Data model (Resolume model, see docs/design/data-model.md): format 5 stores surfaces (mapping) + layers (opacity/blend) with clip slots in 8 columns (media, transport, look); frames are a derived view (surface ⨝ layer ⨝ active clip) so editor, renderers and output keep working; 4.x projects convert on open; packages carry every clip's media. No launcher UI yet (2.1)
- [x] 1.4 Project management: multiple projects + versions in IndexedDB (legacy slot migrated), import always creates a new project, zip packages, linked media folders (Chromium, not yet clicked through in a real browser — the folder picker can't be automated), storage limits from the browser quota
- [x] 1.5 Renderer abstraction + GPU renderer: WebGL2 compositor at parity behind the renderer switch (editor + output), context-loss recovery, CSS fallback. Chose raw WebGL2 over three.js/WebGPU: ISF effects (GLSL) run natively, works where WebGPU is missing, no 600 KB dependency. Open: WebGPU backend (zero-copy video) if the benchmark shows upload costs matter; mesh warp (3.2) builds on this compositor

## Phase 2 progress
- [x] 2.1 Clip launcher (docs/design/clip-launcher.md): layers × columns grid, column trigger (empty cells clear), cue + Go with auto-advance, keyboard 1–9 / Shift+1–9 / Space / L, trigger styles normal/toggle/piano (format 5.1), slot editing (media picker, file drop, drag move/copy, rename, remove), per-layer opacity + clear, + layer / + column. Preload of cued and hovered clips in both renderers and in output windows, hold-last-frame on triggers, start-latency readout. Triggers stay out of undo. Measured in Chrome (automated test browser): preloaded starts 11–18 ms GPU / 12–60 ms CSS, cold starts 75–240 ms — cold is above the 100 ms goal of R7 when several clips load at once, which is what cueing is for
- [ ] 2.2 Master clock, tap BPM, beat snap (quantized triggers)
- [ ] 2.3 Transitions + A/B crossfader (per-clip transition; the hold-last-frame handover in both renderers is the hook)

## Next candidates (see the roadmap report, Phase 1+)
- WebGL compositor behind a renderer abstraction — unlocks true mesh warp (beyond 4 corners), GPU soft-edge blending, and output to multiple displays. The current CSS renderer covers projective quads only.
- Bezier / curved mask edges.
- Timeline for synchronized playback across layers.
- Export composition as video.
- Numeric warp: type corner-pin offsets in the layers panel.
