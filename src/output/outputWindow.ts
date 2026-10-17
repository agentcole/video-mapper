import { createStore, useStore } from 'zustand';
import { OUTPUT_QUERY_PARAM } from './protocol';

// ---------------------------------------------------------------------------
// Opening output windows — on a chosen display where the Window Management
// API exists (Chromium), otherwise as a plain popup the user drags over.
// One window for the whole composition, or one per screen of the project.
// "Display" is the physical monitor or projector; "screen" is the project's
// output (see docs/design/screens.md).
// ---------------------------------------------------------------------------

// Minimal typings for the Window Management API (not in lib.dom yet)
interface ScreenDetailed extends Screen {
  readonly availLeft: number;
  readonly availTop: number;
  readonly left: number;
  readonly top: number;
  readonly isPrimary: boolean;
  readonly label: string;
  readonly devicePixelRatio: number;
}
interface ScreenDetails {
  readonly screens: ScreenDetailed[];
  readonly currentScreen: ScreenDetailed;
}
type WindowWithScreenDetails = Window & { getScreenDetails: () => Promise<ScreenDetails> };

export interface DisplayInfo {
  index: number;
  label: string;
  isPrimary: boolean;
  isCurrent: boolean;
  left: number;
  top: number;
  width: number; // CSS px
  height: number;
  pixelRatio: number; // device px per CSS px
}

export const supportsDisplaySelection = (): boolean =>
  typeof window !== 'undefined' && 'getScreenDetails' in window;

/** Lists the connected displays (asks for the window-management permission). */
export async function getDisplays(): Promise<DisplayInfo[]> {
  const details = await (window as unknown as WindowWithScreenDetails).getScreenDetails();
  return details.screens.map((screen, index) => ({
    index,
    label: screen.label || `Display ${index + 1}`,
    isPrimary: screen.isPrimary,
    isCurrent: screen === details.currentScreen,
    // Full display area: the output covers taskbars/docks once fullscreen
    left: screen.left,
    top: screen.top,
    width: screen.width,
    height: screen.height,
    pixelRatio: screen.devicePixelRatio || 1,
  }));
}

// ---- Detected displays and which display each screen goes to (per machine) ------------

const DISPLAYS_KEY = 'video-mapper-screen-displays';

interface DisplayState {
  displays: DisplayInfo[] | null; // null until detected
  error: string | null;
  // Screen id ('' = the whole composition) → display label
  assigned: Record<string, string>;
}

const storedAssignments = (): Record<string, string> => {
  try {
    const raw = JSON.parse(localStorage.getItem(DISPLAYS_KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
};

export const displayStore = createStore<DisplayState>()(() => ({
  displays: null,
  error: null,
  assigned: storedAssignments(),
}));

export function useDisplays<T>(selector: (state: DisplayState) => T): T {
  return useStore(displayStore, selector);
}

export async function detectDisplays(): Promise<DisplayInfo[] | null> {
  try {
    const displays = await getDisplays();
    displayStore.setState({ displays, error: null });
    return displays;
  } catch (err) {
    displayStore.setState({ error: `Display access denied: ${(err as Error).message}` });
    return null;
  }
}

/** Send a screen's output to a display (by label; null: no preference). */
export const assignDisplay = (screenId: string, label: string | null) => {
  const assigned = { ...displayStore.getState().assigned };
  if (label) assigned[screenId] = label;
  else delete assigned[screenId];
  displayStore.setState({ assigned });
  try {
    localStorage.setItem(DISPLAYS_KEY, JSON.stringify(assigned));
  } catch {
    // per session only
  }
};

/** The display a screen goes to: the assigned one, else one other than the editor's. */
export const displayFor = (screenId: string): DisplayInfo | undefined => {
  const { displays, assigned } = displayStore.getState();
  if (!displays) return undefined;
  const label = assigned[screenId];
  return (label ? displays.find(d => d.label === label) : undefined) ?? displays.find(d => !d.isCurrent);
};

// ---- Windows --------------------------------------------------------------------------------

const outputWindows = new Map<string, Window>();

export const outputUrl = (screenId?: string | null): string => {
  const url = new URL(window.location.href);
  url.search = screenId ? `?${OUTPUT_QUERY_PARAM}=${encodeURIComponent(screenId)}` : `?${OUTPUT_QUERY_PARAM}`;
  url.hash = '';
  return url.toString();
};

/**
 * Open (or move) the output window of a screen (none: the whole
 * composition). With a display it is placed on that display and — where the
 * browser supports fullscreen popups and permission was granted — opened
 * fullscreen right away.
 */
export function openOutputWindow(display?: DisplayInfo, screenId?: string | null): Window | null {
  const key = screenId ?? '';
  const existing = outputWindows.get(key);
  if (existing && !existing.closed) {
    if (display) {
      existing.moveTo(display.left, display.top);
      existing.resizeTo(display.width, display.height);
    }
    existing.focus();
    return existing;
  }
  const features = display
    ? `popup,fullscreen,left=${display.left},top=${display.top},width=${display.width},height=${display.height}`
    : 'popup,width=1280,height=720';
  const name = screenId ? `video-mapper-output-${screenId}` : 'video-mapper-output';
  const opened = window.open(outputUrl(screenId), name, features);
  if (opened) outputWindows.set(key, opened);
  return opened;
}

/** Open a screen's output (null: the whole composition) on its display. False when blocked. */
export const openOutput = (screenId: string | null): boolean =>
  Boolean(openOutputWindow(displayFor(screenId ?? ''), screenId));
