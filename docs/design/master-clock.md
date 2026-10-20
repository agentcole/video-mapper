# Master clock and beat snap (roadmap 2.2)

Status: implemented in project format 5.2.0. Builds on the clip launcher ([clip-launcher.md](clip-launcher.md)).

## Clock

A clock is a tempo and an **origin** — the time of beat 0, which is the start of a bar (`src/state/clock.ts`, pure and tested):

```
beat(t)  = (t − origin) · bpm / 60 000
bar, beat in bar, phase = floor / mod of beat(t) by beatsPerBar
```

- **Time base:** `performance.timeOrigin + performance.now()` — milliseconds since the epoch at high resolution, the same in every window of the browser, so the editor and output windows agree on the beat without exchanging ticks.
- **Where it lives:** the tempo (`bpm`, `beatsPerBar`, `beatSnap`) is part of the project (`ProjectDocument.tempo`, saved, not in undo — like a fader move, and undo never changes the beat). The origin is live state (`liveStore.clockOrigin`), mirrored to outputs; a fresh session starts a bar on load.
- **Tempo changes keep the phase:** `retime` moves the origin so the current beat position doesn't jump.

| Control | Effect |
|---|---|
| BPM field | Type a tempo (20–400), arrows ±1, Shift ±0.1 |
| **Tap** / **T** | From the second tap the tempo is a least-squares fit over the last 16 taps (steadier than averaging intervals); the phase follows the taps and the **first tap of a sequence is the downbeat**. A pause > 2 s starts a new sequence, taps < 100 ms apart are bounces, an interval > 15 % off the tempo restarts the fit from the last tap (keeping the beat count) |
| ÷2 / ×2 | Half / double tempo, phase kept |
| ‹ › (hold) | Bend the beat back / ahead, like a ±4 % pitch bend while held |
| **Resync** / **Shift+T** | Now is the start of a bar |
| 2/4 … 8/4 | Beats per bar |

## Beat snap

`beatSnap` — Off, Beat, Bar, 2 Bars, 4 Bars — is set for the composition and can be overridden per clip (`Clip.beatSnap`, right-click menu; unset = follow the composition). With a snap on, a trigger waits for the next boundary:

- **Clip press** uses the clip's snap; **column triggers** (header, 1–9) and **Go** use the composition's.
- **Grace:** a press up to 50 ms after a boundary counts as on it (the operator meant the beat that just went by).
- **Alt** + click / key fires right away. **Piano** clips never wait — they are a gesture.
- **The later press wins:** a column or Go replaces everything waiting; a clip replaces what waits on its layer. Pressing a waiting clip again keeps it waiting; for **toggle** clips a second press takes the first one back. Clear layer / Clear all also cancel what waits.
- **Display:** cells show *Next* (will start) or *Stop* (toggle off, or an empty cell in the waiting column), the column header blinks, Go blinks, and the toolbar counts the beats to the next trigger.
- **Preload:** waiting triggers count as preload targets, so their clips are loaded and parked on their first frame before the beat — in the editor and in output windows (the waiting list is mirrored).

### Scheduler

`deckActions.ts` keeps waiting triggers in `liveStore.scheduled` (`{ kind, at, beats, … }`) and one `setTimeout` to the earliest. On firing, due triggers run in time order, columns before clips at the same moment. When the clock changes (tempo, tap, nudge, resync), every waiting trigger moves to the boundary of its length that is nearest to its old time on the new grid — and fires at once if that has already passed (e.g. a resync just before the bar). Only the editor schedules and fires; output windows follow the resulting state.

The start-latency readout counts from the beat (the scheduled time), not from when the timer ran, so it includes timer lateness.

## Measurements

Chrome (automated test browser), 149.5 BPM, preloaded 640×360 H.264 clips:

| | Beat → first frame |
|---|---|
| GPU renderer | 10–15 ms |
| CSS renderer | 10–31 ms |
| Output window receives the trigger | ~9 ms after the beat |

A tempo change while a trigger waited fired it 7 ms off the computed new boundary (measurement jitter of the test script).

## Limits / next

- Timers in a **hidden** editor window are throttled by the browser (to 1 s, later 1 min). Since 2.6 waiting triggers use a worker timer, so beat snap stays on the beat when a MIDI controller drives the show from behind the output window (see [midi.md](midi.md)).
- Two windows started at different times derive the shared time base from the system clock; an NTP step in between would offset them by that step.
- **MIDI clock in** follows tempo and bar since 2.6 ([midi.md](midi.md)); no clock out yet. **Ableton Link** needs the companion bridge (4.4).
- **BPM-synced clip playback** (a loop lasts N beats) and beat-synced parameters come with modulation (2.5) and the WebCodecs engine (2.9).
- 2.3 Transitions can take their duration in beats from this clock.
