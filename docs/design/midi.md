# MIDI and key mappings (roadmap 2.6)

Status: implemented. No project format change — mappings belong to the machine and its controllers (localStorage), not to the project. Web MIDI: Chrome and Edge.

## Targets (`src/control/targets.ts`)

What a controller or a key can drive. Targets are addressed by **role and position** — layer row from the top of the launcher, column — not by id, so a controller setup works with every project, like a hardware template.

| Faders (0..1) | Buttons |
|---|---|
| `macro:N`, `master`, `crossfader`, `opacity:ROW` | `slot:ROW:COL`, `column:COL`, `cue:COL`, `go`, `clear:ROW`, `clear-all`, `blackout`, `test-card`, `tap`, `resync`, `nudge:±1` (held), `tempo-half`, `tempo-double`, `snap` (next beat snap) |

Effect and generator parameters are reached through the **macros**: modulate the parameter with a macro (∿, see [modulation.md](modulation.md)) and map the macro — one knob can drive many parameters, and the mapping survives replacing the effect.

Buttons go through the launcher's actions, so beat snap, trigger styles (piano clips are held) and cue/Go behave as with the mouse.

## Mappings (`src/control/mappings.ts`, `engine.ts`)

- A mapping is a **source** — a note, a CC (absolute or relative), pitch bend, or a key (with Shift / Alt) — and a target. A source drives one target; a target can have several sources. Sources remember the input port; an empty device matches every port.
- **Faders:** absolute CC (0–127) and pitch bend (14 bit) set the value; relative encoders (64 ± n, 1 / 127, sign bit) move it by 1/128 per step; a pad sets the level it was hit with; a key toggles 0 / 1. **Takeover:** *Jump* (default) or *Pickup* — the controller only takes over once it passes the current value, and again after the value was moved elsewhere.
- **Buttons:** note on / off, or a CC crossing the middle (127 / 0); held buttons (piano clips, nudge) let go on release.
- **Learn mode** (**M**, or *Learn* in the MIDI panel): every mappable control in the editor ([data-control]) gets a frame with its current mappings (only controls that are visible, not covered by a panel). Click one, then move a knob, press a pad or a key; Delete removes the picked control's mappings, Esc ends. Faders learn continuous controls (CC, pitch bend), buttons learn presses.
- Mapped keys come before the built-in shortcuts; Cmd/Ctrl combinations are never mapped.

## Feedback (`src/control/feedback.ts`)

- LEDs show what their buttons do: *off*, *available* (a clip in the slot, a layer playing), *on*, *cued*, *armed* (waiting for the beat), *playing*. Without a template a button's LED is lit (127) when on / playing / cued / armed. Templates give each state a colour and channel — or several messages, e.g. a colour then a blink against it.
- Faders with `echo` send their value back (encoder rings, the APC40's knob rings).
- Only changes are sent; a controller that (re)connects gets everything. The output that belongs to an input is found by name: the same name, or the same device once the port direction is taken out ("… MIDI Out" / "… MIDI In", "MIDIIN2 (…)" / "MIDIOUT2 (…)", nanoKONTROL2 "SLIDER/KNOB" / "CTRL").
- Feedback runs on store changes (microtasks), not timers, so it keeps up while the editor window is hidden.

## Controller templates (`src/control/templates.ts`)

Detected by port name; *Set up* in the MIDI panel (or apply any template to any input by hand). Grid rows are layers from the top, grid columns are columns.

| Controller | Mapping | Notes |
|---|---|---|
| **Akai APC mini mk2** | 8 × 8 pads; buttons under the pads: play column; buttons on the right: clear layer; faders 1–8: layer opacity, 9: master | Pads: velocity = colour, channel 6 = full brightness, 14 = blink |
| **Novation Launchpad Mini MK3 / Launchpad X** | 8 × 8 pads; top row: play column; right column: clear layer | Switched to programmer mode by SysEx (asks for SysEx access); use the "MIDI" port, not "DAW" |
| **DJ TechTools Midi Fighter Twister** | Bank 1: macros 1–8, opacity of layers 1–6, crossfader, master (push: blackout); rings follow the values, colours per function | |
| **Korg nanoKONTROL2** | Faders: layer opacity; knobs: macros; S: play column, M: clear layer, R: cue column; ▶ Go, ■ Clear all, ● Blackout, Cycle: tap, ◀◀ ▶▶ nudge, Track ◀ ▶ ÷2 ×2, Marker Set: resync | LEDs need "LED Mode: External" (Korg Kontrol Editor) |
| **Akai APC40 mkII** | 5 × 8 pads; Clip Stop: play column; scene buttons: clear layer, Stop All: clear all; track faders: opacity; master, crossfader; track knobs: macros (rings follow); Play: Go, Record: blackout, Tap Tempo, Nudge −/+ | Switched to Alternate mode by SysEx so the host drives all LEDs |

The templates follow the manufacturers' documentation, cross-checked against open-source controller scripts. **They have not been tried on the hardware yet.** Known uncertainties: exact port names per OS (Twister and APC40 on macOS), blink/pulse rates without incoming MIDI clock (Launchpad and Twister fall back to 120 BPM, Akai undocumented — the app doesn't send clock yet), and the APC40's grid orientation (Akai's document doesn't say; Ableton's script and others agree on bottom left = note 0).

Sources: Akai APC mini mk2 Communication Protocol v1.0 and User Guide; Akai APC40 mkII Communications Protocol v1.2 (cdn.inmusicbrands.com); Novation Launchpad Mini [MK3] and Launchpad X Programmer's Reference Manuals (focusrite.com); Midi Fighter Twister user guide and open-source firmware (github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source); Korg nanoKONTROL2 MIDI Implementation and Parameter Guide (korg.com); cross-checked with Ableton Live's remote scripts, Bitwig extensions, DrivenByMoss and Mixxx controller mappings.

## MIDI clock in (`src/control/midiClock.ts`)

Pick an input in the MIDI panel (inputs that send a clock are marked). The master tempo follows the clock — a least-squares fit over the last 4 beats of ticks (24 per beat), like tap tempo. After **Start** (or a Song Position Pointer + Continue) the bar follows the song position: tick 0 is the start of a bar. While the source is stopped, or when joining a running clock, only the tempo follows. A gap of 0.5 s starts over.

## Hidden editor window

MIDI events, the AudioWorklet and BroadcastChannel messages reach a hidden window; its timers and animation frames don't (browsers throttle them to once a second, later once a minute). So everything a controller drives avoids them: beat-snapped triggers wait on a **worker timer** (`src/state/workerTimer.ts`), the editor → output sync and LED feedback coalesce in microtasks.

## Measured / tested

- Unit tests: message parsing and relative encodings; targets by position, faders, buttons, LED states; learn (CC, note, keys, Delete); mapped notes / CC buttons / devices / relative encoders / pitch bend / pickup / held keys; feedback (generic, template colours, multi-message blink, echo); templates (each control mapped once, grid orientation per controller, detection by port name, input ↔ output pairing); MIDI clock (tempo through ±1.5 ms jitter, bar after Start, Song Position, dropout).
- Chrome (automated test browser) with a simulated controller (Web MIDI replaced by a test double): learn mode frames and labels, a learned pad triggers its clip and its LED follows (on, off, waiting); beat-snapped MIDI triggers fire 3–5.5 ms after the bar via the worker timer; the APC mini mk2 template detected by port name and set up (89 mappings, 80 LED messages, exactly the slots with clips lit), pads / column buttons / faders / scene buttons drive the launcher with the right LED colours; MIDI clock at 125 BPM with ±1 ms jitter → master 124.99 BPM, bar start 0.07 ms off; key learn (M, click, key, Esc); no console errors.
- **Not tested on real controllers** — see the uncertainties above.

## Next

- Send MIDI clock (so controller LED blinks follow the master tempo) and clock out to other gear.
- Hold-to-shift layers for controllers with more layers than rows; banks for the Twister.
- OSC and a web remote (phase 4/5).
