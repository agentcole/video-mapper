# Screens and slices (roadmap 3.1)

Status: implemented in project format 5.6.0. Both renderers; output windows per screen.

## Why

Until now an output window showed the whole composition, letterboxed. That covers one projector. Several projectors (a wide wall from two beamers, a stage with a side screen) need what every mature mapper has: the composition is the **content**; each **output** takes its own part of it, at its own resolution, with its own warp. Resolume calls this Advanced Output (screens → slices with *input selection* and *output transformation*); HeavyM's screens on a fixed canvas are the closest match to this app's fixed composition.

## Model

```
ProjectDocument
├── composition (content, mapped with surfaces as before)
└── screens[]            — outputs: a projector or display
      id, name
      width, height      — its resolution (screen px)
      slices[]           — drawn in order, later ones on top
        id, name, enabled
        input:  { x, y, width, height }   — a rectangle of the composition (composition px)
        output: [TL, TR, BR, BL]          — where it lands on the screen (screen px, a corner pin)
```

- **No screens** (every project before 5.6, and new ones): output windows show the whole composition, as before.
- **With screens** each output window shows one screen (`?output=<screen id>`); a window for the whole composition (`?output`) still works.
- Screens are mapping/calibration: saved with the project, undoable, mirrored to output windows. Which **display** a screen's window opens on is per machine (Window Management API, remembered by display label in localStorage).
- The composition is the content resolution: a slice that enlarges a small input shows the composition's pixels enlarged. Changing the composition size doesn't move the slices (like surfaces).

## Rendering

- **GPU:** the compositor renders the composition into its targets — at the composition's resolution, or less when the slices show it smaller (the editor preview), in steps of a quarter so dragging a corner doesn't reallocate textures — then draws the screen: each enabled slice is a quad at its output corners; per pixel the inverse homography (screen px → the slice's unit square) gives the point in the input rectangle (`SLICE_FRAGMENT`). Edges are antialiased; outside the composition is transparent. Master fader on the slices, blackout and test card as DOM overlays.
- **CSS:** each slice is a copy of the composition DOM, clipped to the input rectangle (`overflow: hidden`) and warped with `matrix3d` onto the output corners (`ScreenDom`). Every slice plays its own copy of the media (only the first one is audible); fine for a slice per screen, heavier with many.
- Output windows that show a screen: test card is the **screen's** (name and resolution, for focusing and keystoning the projector); the composition grid isn't shown (it is in composition px). A window whose screen was deleted stays black (a hint appears when the mouse moves).

## Editor

*Screens* in the Output section (left panel) opens the screen editor; the right panel becomes the **Screens** panel and the stage shows:

- **Input** — the composition with every slice's input rectangle (the selected screen's solid, others dashed). Drag to move, edges and corners to resize; snaps to the composition's borders and middle and to other slices' edges (or to the grid when grid snapping is on).
- **Output** — the selected screen as its window shows it, with the slices' corners: drag a corner to warp (folded quads are refused), the inside to move; snaps to the screen's borders and middle and to other slices' corners. A 4 × 4 grid through the warp shows the perspective.
- Arrow keys move the selection by 1 px (Shift: 10): the selected corner, else the slice's output — or its input in the Input view. Alt drags without snapping. Delete removes the slice, Cmd/Ctrl+D duplicates it, Esc deselects, then closes the editor. The launcher, tempo and blackout keys keep working.
- **Panel:** screens (live dot when a window shows them), *+ Screen* (the composition's size, showing all of it), *Split…* (columns × rows with overlap — one screen per projector, each the size of its part; replaces the screens), name, resolution (common sizes and the detected displays in device pixels; the slices scale with the screen), display, *Open output*, delete; slices (show/hide, rename, order, duplicate, delete); numbers for the input rectangle and the four corners; *Whole* (input = the composition), *Fill screen* (output = the screen's corners), *= Input* / *= Output* (copy one onto the other at the same coordinates).
- The left panel lists the screens with an open button each and *Open all* (browsers may let only the first window of a click through — then open them one by one or allow pop-ups).

## Measured / tested

- Unit tests: split (side by side, overlap with rounding, rows × columns), homographies both ways (input corners → output corners, screen → unit square), folded quads refused, match input/output, magnification, screen resize scales the slices, rectangle resizing, snapping; actions (add, duplicate, reorder, remove, nudge corner / output / input, split, delete selects the next); project format (round trip, older projects have none, broken slices / screens / duplicate ids skipped with warnings); undo.
- Chrome (automated test browser), GPU renderer, pixel probes with a four-colour composition: no screen = the composition; a 960 × 1080 screen showing the right half shows exactly it; two slices swapped land swapped; a whole composition on a trapezoid hits the expected colour at the homography's image of each quadrant centre and black outside; master 50 % halves; a hidden slice draws nothing.
- Editor: split into two screens, Input / Output views, corner drag (warps live, snapping, Alt), body move with snap, input resize with snap, arrow keys, Esc, delete + undo. Output window `?output=<id>`: shows its screen (both renderers identical), follows corner drags live, screen test card, black after the screen is deleted and back after undo; the editor shows it as live. No console errors.
- Not tested with real projectors or several physical displays.

## Next

- 3.2 Mesh warp inside the corner pin (per slice and per surface).
- 3.5 Edge blending between overlapping screens (the split's overlap is the place for it), colour correction per screen.
- 3.7 Virtual screens and screen-to-screen routing; polygon input shapes and output masks (3.4).
