# Editor UI style

The clip launcher set the look; every panel, dialog and control now follows it. The shared pieces live in `src/components/ui/theme.ts` (class tokens), `ui/button.tsx`, `ui/input.tsx`, `ui/slider.tsx` and `ui/dialog.tsx` — use them instead of new one-off classes.

## Surfaces

| Token | Used for |
|---|---|
| `panelSurface` — black 85 % glass, `rounded-lg`, big shadow | Docked panels: control panel, layers, launcher |
| `dialogSurface` — near-black glass with a hairline border | Modal dialogs (`Dialog`), floating editors (background) |
| `menuSurface` | Context menus, frame popovers |
| `noticeSurface` (+ amber / red ring for warnings / errors) | Toasts over the stage |

Panel titles are `text-sm` bold with a 16 px icon; section labels are 10 px uppercase gray (`sectionLabel`); body text is `text-xs`, secondary text gray-400, hints gray-500. Dividers are `border-white/10`.

## Controls

- **Buttons** (`Button`): `outline` is the neutral button (white 10 %, hover 20 %); `default` is *on / selected* (cyan); `destructive` red; `ghost` for quiet toolbar actions. Icons inside are sized by the button (14 px).
- **Segmented choices** (`segmented` + `segment(selected)`): tabs, renderer, media source, background type.
- **Fields** (`field`): inputs and selects on white 10 % with a cyan focus ring; `color-scheme: dark` keeps native dropdowns and scrollbars dark.
- **Icon buttons** (`iconButton`): close, collapse, row actions.

## Colors carry meaning

| Color | Meaning |
|---|---|
| Cyan | On / selected / focus — never decoration, so a cyan control always means "this is active" |
| Amber | Show timing: cue, Go, beat snap, waiting triggers |
| Emerald | Playing, outputs live |
| Red | Blackout, delete, errors |

Primary-looking actions (Present, Output window, Upload, New project) stay neutral; only state is colored.
