// ---------------------------------------------------------------------------
// The editor's look, in one place (the clip launcher set it): dark glass
// panels, small type, quiet white-alpha controls and a few signal colors:
//   cyan    — on / selected / focus
//   amber   — show timing: cue, Go, beat snap, waiting triggers
//   emerald — playing
//   red     — blackout, delete, errors
// ---------------------------------------------------------------------------

/** Docked panels (control panel, layers, launcher). */
export const panelSurface = 'bg-black/85 backdrop-blur-md text-white rounded-lg shadow-2xl';

/** Modal dialogs and floating editors. */
export const dialogSurface = 'bg-neutral-950/95 backdrop-blur-md text-white rounded-lg shadow-2xl border border-white/10';

/** Context menus and popovers. */
export const menuSurface = 'bg-neutral-900/95 backdrop-blur border border-white/10 rounded-md shadow-2xl text-white';

/** Toasts and notices over the stage. */
export const noticeSurface = 'bg-black/85 backdrop-blur-md text-white text-xs rounded-lg shadow-2xl px-3 py-2';

/** Panel titles: bold, small, with a 16 px icon. */
export const panelTitle = 'font-bold text-sm flex items-center gap-2';

/** Section labels inside panels and menus. */
export const sectionLabel = 'text-[10px] uppercase tracking-wider font-semibold text-gray-400';

/** Text inputs, number fields and selects. */
export const field = 'bg-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400';

/** Options inside a dark select. */
export const option = 'bg-neutral-900 text-white';

/** Small square icon buttons (close, collapse, row actions). */
export const iconButton = 'p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30';

/** A row of choices where one is selected (tabs, renderer, media source). */
export const segmented = 'flex rounded bg-white/10 p-0.5 gap-0.5 text-xs';
export const segment = (selected: boolean) =>
  `flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded whitespace-nowrap transition-colors ${
    selected ? 'bg-cyan-500 text-black font-semibold' : 'text-gray-300 hover:bg-white/10 hover:text-white'
  }`;

/** Dividers between panel sections. */
export const divider = 'border-white/10';
