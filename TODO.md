# TODO

## Done
- [x] Add a grid for mapping — grid overlay + snap-to-grid, G / Shift+G shortcuts, size selector, optional visibility in present mode. Settings persist with the project.
- [x] Unified corner pin (the research item below) — the shape now warps through the same homography as the content for every shape (rectangle, circle, polygon, triangle). Polygon "warp" texture mode works for quads. A warped editing grid shows during corner-pin editing, and corner handles snap to the canvas grid.
- [x] Fixed composition resolution (Resolume model), undo/redo, multi-select + marquee + clipboard, rotation-aware resize, layers panel with numeric properties, soft edge masks, per-frame + global test patterns, master fader + blackout (B), export with embedded media.

## Corner-pin research notes (resolved)

The old inconsistency: the homography (`matrix3d`) and the shape (`clip-path`) were applied to the same element, so enabling corner pin replaced the shape clip with the quad. Now the content element gets the homography and the *wrapper* gets a clip-path whose vertices are transformed through the same homography (straight edges stay straight under a homography; circles are approximated as 48-gons when warped). See `src/lib/geometry.ts` and the "Unified warp model" block in `src/components/MediaFrame.tsx`.

## Next candidates
- WebGL compositor behind a renderer abstraction — unlocks true mesh warp (beyond 4 corners), GPU soft-edge blending, and output to multiple displays. The current CSS renderer covers projective quads only.
- Bezier / curved mask edges.
- Timeline for synchronized playback across layers.
- Export composition as video.
- Numeric warp: type corner-pin offsets in the layers panel.
