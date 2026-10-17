import React, { useState } from 'react';
import { ExternalLink, X, ScanSearch } from 'lucide-react';
import { Button } from './ui/button';
import { field, option, segment, segmented } from './ui/theme';
import { useOutputStatus, closeOutputs } from '../output/controlSync';
import { liveStore, useLiveStore } from '../state/liveStore';
import { getScreens, openOutputWindow, supportsScreenSelection, type ScreenInfo } from '../output/outputWindow';

// Output window controls: pick a screen (Chromium), open/move the output,
// see whether it is connected, close it.
export const OutputWindowControls: React.FC = () => {
  const connected = useOutputStatus(s => s.connected);
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canSelectScreen = supportsScreenSelection();
  const renderer = useLiveStore(s => s.renderer);

  const detectScreens = async () => {
    setError(null);
    try {
      const found = await getScreens();
      setScreens(found);
      // Default to a screen other than the editor's — usually the projector
      const other = found.find(s => !s.isCurrent);
      setScreenIndex((other ?? found[0]).index);
    } catch (err) {
      setError(`Screen access denied: ${(err as Error).message}`);
    }
  };

  const open = () => {
    setError(null);
    const screen = screens?.find(s => s.index === screenIndex);
    if (!openOutputWindow(screen)) {
      setError('The browser blocked the output window — allow pop-ups for this site.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-400">Renderer</span>
        <div className={`flex-1 ${segmented}`}>
          {(['css', 'gpu'] as const).map(kind => (
            <button
              key={kind}
              onClick={() => liveStore.getState().setRenderer(kind)}
              className={segment(renderer === kind)}
              title={kind === 'gpu'
                ? 'WebGL2 compositor (beta): per-pixel perspective, GPU blend modes'
                : 'Browser layout (CSS transforms) — the proven path'}
            >
              {kind === 'css' ? 'CSS' : 'GPU (beta)'}
            </button>
          ))}
        </div>
      </div>
      {canSelectScreen && (
        screens ? (
          <select
            value={screenIndex}
            onChange={(e) => setScreenIndex(Number(e.target.value))}
            className={`w-full ${field}`}
            title="Screen for the output window"
          >
            {screens.map(s => (
              <option key={s.index} value={s.index} className={option}>
                {s.label} — {s.width}×{s.height}{s.isCurrent ? ' (this screen)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <Button variant="outline" size="sm" onClick={detectScreens} className="w-full">
            <ScanSearch />
            Detect screens
          </Button>
        )
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={open}
          className="flex-1"
          title="Open the composition in its own window (for the projector)"
        >
          <ExternalLink />
          {connected > 0 ? 'Show output' : 'Output window'}
        </Button>
        {connected > 0 && (
          <Button variant="outline" size="sm" onClick={closeOutputs} title="Close output windows">
            <X />
          </Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {connected > 0
          ? <span className="text-emerald-300">● {connected} output{connected > 1 ? 's' : ''} live — editor audio muted</span>
          : 'No output window. Present (P) shows the output in this window.'}
      </p>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
};
