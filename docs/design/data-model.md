# Data model: surfaces, layers, clips (roadmap 1.3)

Status: implemented in project format 5.0.0. Decision: the Resolume model ("A") — content is played by **layers** holding **clips** in **columns**; **surfaces** map that content onto the projection.

## Why

Up to 4.x a *frame* was everything at once: a mapped surface, one media file, its playback and look. That blocks every VJ feature (triggering, columns, crossfades) and mixes calibration with content — MadMapper users' top complaint is re-mapping every scene after a venue change because scenes store geometry. Separating the two fixes both.

## Model

```
ProjectDocument (format 5)
├── composition, grid, background
├── surfaces[]  — Stage: where content appears
│     id, name, visible, testPattern, zIndex
│     x, y, width, height, rotation, shape, vertices, lockAspectRatio
│     perspectiveMode, perspectiveCorners, softEdge
│     layerId ──────────────┐   (content source; later also composition regions, 3.1)
├── columns[]  — id, name   │   (8 by default: the deck's trigger columns)
└── layers[]   — Show       ▼
      id, name, opacity, blendMode
      slots[columnIndex] → Clip | null
      activeClipId          (persisted: the startup state of installations)

Clip
  id, name, source { type, url, mediaId, filename }
  loop, playbackRate, muted
  flipHorizontal, flipVertical, contentScale, contentOffsetX/Y   (content transform)
  blur, brightness, contrast, grayscale, saturate, hueRotate, invert, sepia   (look)
```

Ownership of the former frame fields:

| Surface (mapping) | Layer (mix) | Clip (content) |
|---|---|---|
| geometry, shape, corner pin, soft edge, visibility, test pattern, z-order, name | opacity, blend mode | media, transport, filters, flip/zoom/pan |

## Frames are now a derived view

The editor, both renderers, the output window and undo keep working on `MediaFrame` — now computed as **surface ⨝ layer ⨝ active clip** (`framesFromShow`). Writes go back through the inverse (`showFromFrames`): geometry to the surface, opacity/blend to the layer, everything else to the layer's active clip.

- A new frame creates a surface, a layer and a clip in column 1.
- Deleting a frame deletes its surface; a layer goes with its last surface (layers that never had a surface are kept — they belong to the show).
- Derived frames keep their object identity when nothing changed, so memoized frame components don't re-render.
- One layer can feed several surfaces; edits to its opacity/blend/clip then affect all of them (no UI for sharing yet).

This keeps 1.3 a pure data-model change. The clip launcher (2.1) works on layers and columns directly: triggering a clip sets `activeClipId`, and every surface of that layer shows it.

## Migration

`parseProjectData` turns any 4.x project (`frames[]`) into surfaces + layers + clips: one layer per frame, its media as the clip in column 1. Project files, packages, the repository and output sync all carry format 5; output windows still receive derived frames.

## Next

- ~~2.1 Clip launcher: layers × columns grid, column trigger, preload.~~ Done — see [clip-launcher.md](clip-launcher.md). Format 5.1 adds `Clip.triggerStyle`.
- ~~2.2 Master clock + beat snap.~~ Done — see [master-clock.md](master-clock.md). Format 5.2 adds `tempo` and `Clip.beatSnap`.
- ~~2.3 Transitions: a layer crossfades from the old to the new active clip.~~ Done — see [transitions.md](transitions.md). Format 5.3 adds `Layer.transition`, `Layer.crossfade` and `Clip.transition`.
- ~~2.4 Effects.~~ Done — see [effects.md](effects.md). Format 5.4 adds `Clip.effects`, `Clip.generator`, `Layer.effects`, the composition's `effects` and the `shaders` a project carries.
- ~~2.5 Modulation.~~ Done — see [modulation.md](modulation.md). Format 5.5 adds `mods` on effects, generators and layers, and the composition's `macros`.
- ~~3.1 Screens/slices.~~ Done — see [screens.md](screens.md). Format 5.6 adds `screens`: outputs with their own resolution whose slices take a rectangle of the composition onto four corners. Surfaces that sample a region of the composition (instead of a layer) remain open (3.7).
