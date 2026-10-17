# Clip launcher (roadmap 2.1)

Status: implemented. Builds on the format-5 data model ([data-model.md](data-model.md)): a layer holds clips in column slots, `activeClipId` says which one plays, and every surface of the layer shows it.

## Behaviour

| Action | Effect |
|---|---|
| Press a clip (thumbnail) | Plays it on its layer, by the clip's trigger style |
| Press a column header, or **1–9** | Every layer plays its clip in that column; layers with an empty cell there are cleared (Resolume's column trigger) |
| Cue a column (crosshair, **Shift+1–9**) | Its clips are preloaded; **Go** / **Space** fires it and cues the next column |
| Layer ✕ / *Clear all* | Stops the layer's / every layer's clip |

Trigger styles (per clip, right-click): **normal** — press plays from the top, pressing the playing clip restarts it; **toggle** — pressing the playing clip clears the layer; **piano** — plays while held, on release the clip that played before comes back (on an otherwise empty layer that means off). Resolume's piano stops the clip; returning to the previous one is a superset that also covers flash/stutter clips on a busy layer.

Editing: empty slot → media picker; files dropped on a slot fill it and the slots to its right; drag a clip by its label to move it (swap with the target) or Alt-drag to copy; right-click to rename / replace / remove; per-layer opacity fader; *+ Layer* adds a layer on a full-composition surface on top; *+ Column* adds a column to every layer. A clip keeps playing when moved within its layer and stops when it moves to another layer.

## State

- **Document (undoable, saved):** slots, columns, names, trigger styles, and `activeClipId` (what plays is the startup state of an installation).
- **Not in undo:** triggers. `history.ts` ignores changes where only `activeClipId` differs, and a restored snapshot keeps the clips that play now (if they still exist). Undo never changes the picture on the projector.
- **Live (not saved, mirrored to outputs):** `cuedColumn`, `preloadClipId` (clip under the pointer), and `layerTriggers` — a counter per layer, bumped on every start, so renderers restart a clip that is triggered again.

Output windows now receive the whole show (all clips, URLs of stored media stripped) instead of derived frames, resolve every clip's media up front, and preload the same clips as the editor.

## Starting without a gap (R7)

Both renderers keep **preloaded** clips as loaded, paused media elements parked on their first frame, keyed by clip, so a trigger only calls `play()`:

- **CSS:** each surface renders its media as one keyed list — preloads (invisible), a *pending* clip and the *shown* one. React keeps the element when a clip moves from preload to pending to shown, so the loaded video is reused. A pending clip stays invisible behind the previous clip until it has a frame (hold-last-frame), then takes over.
- **GPU:** `MediaPool` entries are keyed by clip (surfaces of one layer share one element and stay in sync); preloads are inactive entries. The compositor keeps drawing a frame's previous media until the new one is ready.

A Chrome detail: a video that isn't composited (the GPU renderer's media are off-DOM) only gets its frames presented by a background-render timer after ~250 ms, so `requestVideoFrameCallback` stays silent and a preloaded clip looked frozen for a quarter second. A texture upload pulls the current frame directly, so after every (re)start the pool uploads each animation frame for up to 1 s, until frame callbacks flow again.

Measured in Chrome (automated test browser, 640×360 H.264 test clips, two layers triggered at once), from the trigger to the clip moving on screen — the toolbar shows the same number for the last trigger:

| | GPU | CSS |
|---|---|---|
| Preloaded (cued / hovered) | 11–18 ms | 12–60 ms |
| Cold | 75–150 ms | ~150–240 ms |

Cold starts miss R7's 100 ms when several clips load at once — cueing is the answer for those moments. Numbers on show hardware with real content still need to be taken.

## Next

- ~~2.2 Beat-quantized triggers (launch on the next beat/bar) plug into `deckActions` — the trigger becomes a scheduled action.~~ Done — see [master-clock.md](master-clock.md).
- ~~2.3 Transitions: the pending → shown handover in both renderers is where a crossfade goes.~~ Done — see [transitions.md](transitions.md).
- 2.6 MIDI learn maps notes to `pressClip` / `triggerColumn` / `go`; piano clips map naturally to note on/off.
