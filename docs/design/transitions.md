# Transitions and A/B crossfader (roadmap 2.3)

Status: implemented in project format 5.3.0. Builds on the launcher ([clip-launcher.md](clip-launcher.md)) and the master clock ([master-clock.md](master-clock.md)).

## Transitions

A **transition** is a dissolve: when a layer starts another clip, the new clip fades in over the old one; when a layer is cleared, its clip fades out.

- **Where it is set:** per layer (`Layer.transition`, layer menu — right-click the layer header or click its `⇢` chip), and per clip as an override for when *that* clip comes in (`Clip.transition`, clip menu → *Transition in*: *Layer* follows the layer, *Cut* forces a cut). Clearing a layer uses the layer's transition.
- **Length:** seconds or **beats** of the master clock (`{ duration, beats? }`) — presets Cut, 0.25 / 0.5 / 1 / 2 / 4 s, 1 / 2 / 4 / 8 beats. Beat lengths follow the tempo at the moment the dissolve starts.
- **Timing:** the dissolve starts when the new clip has its first frame (the hold-last-frame handover from 2.1), so a cold start never fades in from black. A re-trigger of the playing clip restarts it with a cut. A trigger during a running dissolve continues from the clip that was fading in.
- **Undo / saving:** settings are document edits (undoable, saved); dissolves themselves are live.
- Frames carry the resolved transition as a derived field (`MediaFrame.transition` = the playing clip's own, else the layer's), like `clipId`; it is never written back.

### Renderers

- **CSS:** the outgoing media element stays under the incoming one and keeps its own look (filters, flip, zoom — each media element now carries its clip's look, not the frame's). The incoming element fades in with the Web Animations API, so the fade runs on the compositor regardless of React's timing; a cleared layer's element fades out the same way and is removed afterwards.
- **GPU:** the frame shader samples both clips — each with its own look (`struct Look`) — and mixes them premultiplied **before** blending, so a layer's blend mode and opacity apply once to the dissolve (two separate draws would apply e.g. *screen* twice). The compositor keeps `{ item, frame }` per surface for what is on screen and a fade per surface; the outgoing media keeps playing until the dissolve ends, and frames are redrawn every animation frame while a dissolve runs.

## A/B crossfader

- Layers can sit on **side A or B** (`Layer.crossfade`; the `A/B` chip on the layer header cycles off → A → B, or the layer menu). The crossfader (`liveStore.crossfader`, 0 = A … 1 = B, mirrored to output windows, not saved; double-click centres it) scales those layers' opacity.
- **Curve:** both sides are full in the middle — `A = min(1, 2·(1−x))`, `B = min(1, 2·x)`. With B stacked over A that makes the fader a true dissolve in both directions: B fades in over A, then A goes away behind it (and back). Layers without a side are not affected.
- The gain is applied to the frames handed to the renderers (`applyCrossfader`), never to the document, so editing tools keep showing the layer's own opacity.

## Measured

Chrome (automated test browser): a 2 s layer transition ramps the incoming element linearly (0.08 → 0.88 in 400 ms steps) and removes the old one at the end; clearing fades out the same way; a 4 s dissolve in the output window (CSS) runs 0.07 → 0.94 over 4 s; the GPU renderer shows both clips mixed mid-dissolve; the crossfader at 0.75 / 0.8 gives side A 0.5 / 0.4 of its opacity in editor and output.

## Next

- Wipes, slides and other shader transitions come with ISF (2.4) — the GPU mix point is where a transition shader goes.
- The crossfader curve could become selectable (dip / plateau) once layers can be grouped; MIDI mapping (2.6) gives it a hardware fader.
