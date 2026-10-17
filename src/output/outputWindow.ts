import { OUTPUT_QUERY_PARAM } from './protocol';

// ---------------------------------------------------------------------------
// Opening output windows — on a chosen screen where the Window Management
// API exists (Chromium), otherwise as a plain popup the user drags over.
// ---------------------------------------------------------------------------

// Minimal typings for the Window Management API (not in lib.dom yet)
interface ScreenDetailed extends Screen {
  readonly availLeft: number;
  readonly availTop: number;
  readonly left: number;
  readonly top: number;
  readonly isPrimary: boolean;
  readonly label: string;
}
interface ScreenDetails {
  readonly screens: ScreenDetailed[];
  readonly currentScreen: ScreenDetailed;
}
type WindowWithScreenDetails = Window & { getScreenDetails: () => Promise<ScreenDetails> };

export interface ScreenInfo {
  index: number;
  label: string;
  isPrimary: boolean;
  isCurrent: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export const supportsScreenSelection = (): boolean =>
  typeof window !== 'undefined' && 'getScreenDetails' in window;

/** Lists the connected screens (asks for the window-management permission). */
export async function getScreens(): Promise<ScreenInfo[]> {
  const details = await (window as unknown as WindowWithScreenDetails).getScreenDetails();
  return details.screens.map((screen, index) => ({
    index,
    label: screen.label || `Screen ${index + 1}`,
    isPrimary: screen.isPrimary,
    isCurrent: screen === details.currentScreen,
    // Full screen area: the output covers taskbars/docks once fullscreen
    left: screen.left,
    top: screen.top,
    width: screen.width,
    height: screen.height,
  }));
}

let outputWindow: Window | null = null;

export const outputUrl = (): string => {
  const url = new URL(window.location.href);
  url.search = `?${OUTPUT_QUERY_PARAM}`;
  url.hash = '';
  return url.toString();
};

/**
 * Open (or move) the output window. With a screen it is placed on that
 * screen and — where the browser supports fullscreen popups and permission
 * was granted — opened fullscreen right away.
 */
export function openOutputWindow(screen?: ScreenInfo): Window | null {
  if (outputWindow && !outputWindow.closed) {
    if (screen) {
      outputWindow.moveTo(screen.left, screen.top);
      outputWindow.resizeTo(screen.width, screen.height);
    }
    outputWindow.focus();
    return outputWindow;
  }
  const features = screen
    ? `popup,fullscreen,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
    : 'popup,width=1280,height=720';
  outputWindow = window.open(outputUrl(), 'video-mapper-output', features);
  return outputWindow;
}
