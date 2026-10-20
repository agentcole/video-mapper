# Mesh warp (roadmap 3.2)

Status: implemented in project format 5.7.0 for surfaces and slices. Drawn by the GPU renderer; the CSS renderer shows the corner pin only.

## Why

A corner pin (one homography) is right for a flat surface seen at an angle. Real surfaces are not always flat: a curved wall, a column, a screen that sags, a projector lens that bends straight lines. Every mature mapper layers a **grid warp inside the corner pin** for this: Resolume (Bezier / linear grid inside the output transformation), MadMapper, Millumin, WATCHOUT (perspective vs. bilinear), TouchDesigner's stoner (4-point keystone first, then the inner mesh). The roadmap item: N × M mesh, linear or curved, inside the corner pin, with a perspective / bilinear switch.

## Model

```
Surface / Slice
├── corner pin   — a surface's perspectiveCorners, a slice's output (as before)
├── bilinear?    — the corners interpolate bilinearly instead of in perspective
└── mesh?        — MeshWarp
      columns, rows        2 … 17 control points per side
      points[]             columns × rows, row by row from the top left,
                           in the pin's unit square (0..1); flat = a regular grid
      smooth               curves through the points (else straight between them)
```

A warp maps the content's unit square — a surface's box, a slice's input rectangle — to the output in two layers:

```
param (u, v) ──mesh──▶ pin space (s, t) ──corner pin──▶ output px
```

- **Mesh points live in pin space.** Moving a corner keeps the bends where they are relative to the corners (like stoner: keystone first, then the fine warp).
- **Linear:** bilinear interpolation between the four points around each cell. **Smooth:** a uniform Catmull-Rom surface through the points (interpolating: each point stays where it was dragged; the curve's tangents come from the neighbours — Bezier handles without having to edit handles). Beyond the border the grid continues in a straight line, so both reproduce a flat grid exactly.
- **Perspective** (default): the corner homography — straight lines stay straight. **Bilinear:** the corners blended bilinearly — even spacing along every edge, straight lines bend; for surfaces only once the corner pin is on.
- Resizing the mesh resamples the current bends onto the new grid (exact where the grids share lines, e.g. 4 → 7). A polygon surface whose box refits after a vertex edit crops its mesh to the new box, so nothing moves.
- Mesh and pin mode are mapping data: saved, undoable, mirrored to output windows. Which mesh is being edited and its selected points are UI state.

## Rendering (GPU)

- Surfaces and slices are drawn as **warp meshes** (`buildWarpGeometry`): a grid of triangles whose vertices carry the homogeneous output position (x·w, y·w, w) and where in the content they are (u, v). The GPU divides by w, so a corner pin without a mesh is **one cell and exactly the homography**, and (u, v) is interpolated in perspective — no seam along the diagonal. Bends get more cells: 4 per mesh cell when linear, 8 when smooth, 32 per side for a bilinear pin, at most 160.
- The grid is grown by 2 px on every side (the params continue past 0..1) so the shader's antialiased edges aren't cut off; never past the horizon of a strong perspective.
- The fragment shaders no longer map pixels back through the inverse homography: a surface's pixel gets its box position from the mesh (`v_uv × size`), then the content mapping (flip, zoom, pan, cover), shapes, soft edges and blend modes run as before. A slice's pixel samples its input rectangle at `v_uv`.
- Meshes are uploaded once per surface / slice and redrawn until their geometry changes (inputs compared by identity); meshes of surfaces and slices no longer drawn are freed.
- **CSS renderer:** `matrix3d` can only do one homography per element, so it shows the corner pin and ignores mesh and bilinear (the warp panel says so). It is kept as the fallback, not extended.

## Editor

- **Warp** section — in the layer properties for a surface, in the slice settings for a slice: *Perspective / Bilinear*; *Add mesh* (4 × 4, smooth); then the grid size (columns × rows), *Linear / Smooth*, *Edit points*, reset (the selected points, or all), remove.
- **Edit points** shows the mesh's points on the stage where they land, with the curves through them; for a slice the screen editor switches to its screen (Output view). The other handles (corner pins, resize, rotate, vertices) step aside while points are edited.
- Drag a point — it stays under the pointer (moved in pin space). Click selects, Shift+click adds or removes; dragging moves every selected point. Arrow keys move the selected points by 1 px (Shift: 10) in screen directions, also on rotated surfaces. Cmd/Ctrl+A selects all points, Delete does nothing (the surface stays), Esc deselects the points, then ends editing. Selecting another surface or slice ends it too.
- Outlines, click areas, polygon vertices and the warped editing grid follow the mesh: a bulge beyond the box can be clicked, vertices on a bent surface stay under the pointer.

## Format

5.7 adds `bilinear` and `mesh` to surfaces and slices. A broken mesh (wrong number of points, out-of-range size) is removed with a warning; its surface or slice stays. Older projects have none.

## Measured / tested

- Unit tests: flat meshes are the identity (linear and smooth, also past the border), meshes pass through their points, linear is straight between them and smooth curves, resize keeps the bends, crop keeps the picture, homography / bilinear pin, inverse of every warp kind (Newton, with a coarse search for strong bends), unpin to pin space, tessellation (one exact cell for a perspective pin, more for bends), padding, affine (rotation) on homogeneous positions; editor actions (add / remove, a slice's mesh opens its screen and ends when the editor moves on, moving points by output px through the pin, rotated surfaces in screen directions, reset selected / all, resize, smooth, bilinear); project format (round trip, older projects, broken mesh removed with a warning); show model (fields reach the surface; a loaded surface without optional fields stays the same object).
- Chrome, GPU renderer. **Regression:** a scene of six surfaces (rotated, pinned, circle, polygon with soft edges, zoomed / flipped media at 80 %, difference blend) and a screen with two pinned slices, rendered before and after the switch to warp meshes: 5 of 921,600 composition pixels and 27 of 600,000 screen pixels differ, all on surface edges where a pixel centre lies exactly on the edge — the old renderer left those out (32 → 171), the warp mesh gives them half coverage (32 → 141 → 171).
- **Warp accuracy:** content an 8 × 8 colour grid; for 80 random points (u, v) the pixel at the warp's image of (u, v) shows (u, v)'s colour — rotated surface, pinned, pinned bilinear, linear mesh, smooth mesh + pin, smooth mesh + bilinear pin, and slices pinned, bilinear, linear mesh, smooth mesh + bilinear, a 17 × 17 mesh: all 80 / 80. Controls: the same picture checked against the warp without its mesh fails 23 of 80, bilinear checked against perspective 37 of 80.
- Editor: add a mesh, drag a point (it moves exactly with the pointer: 120 × 60 px), Shift+arrow (10 px, the surface stays), Linear and 4 → 7 columns (same shape), Esc, undo; corner pin + bilinear + rotation + a bulge beyond the box (clicking the bulge selects the surface; outline, grid and handles follow); a slice's mesh in the screen editor, its output window shows the same picture and follows a reset live; CSS renderer shows the note and the corner pin. No console errors from the app.
- Not tested on a real curved surface or with a projector.

## Next

- 3.3 Piecewise-affine "linear" polygon warp (drag a polygon's vertices with the texture following, Resolume poly-slice style).
- 3.4 Output-space masks, mask "attach to" (surface / input / output).
- 3.5 Edge blending between overlapping screens, colour correction per screen.
- Mesh nice-to-haves: marquee selection of points, select a row / column, Bezier handles, mesh presets (cylinder, sphere), copy a mesh between slices.
