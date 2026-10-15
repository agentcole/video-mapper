import React, { useState } from 'react';
import { ExternalLink, X, ScanSearch } from 'lucide-react';
import { Button } from './ui/button';
import { useOutputStatus, closeOutputs } from '../output/controlSync';
import { getScreens, openOutputWindow, supportsScreenSelection, type ScreenInfo } from '../output/outputWindow';

// Output window controls: pick a screen (Chromium), open/move the output,
// see whether it is connected, close it.
export const OutputWindowControls: React.FC = () => {
  const connected = useOutputStatus(s => s.connected);
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canSelectScreen = supportsScreenSelection();

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
      {canSelectScreen && (
        screens ? (
          <select
            value={screenIndex}
            onChange={(e) => setScreenIndex(Number(e.target.value))}
            className="w-full bg-white/10 rounded px-2 py-1.5 text-xs"
            title="Screen for the output window"
          >
            {screens.map(s => (
              <option key={s.index} value={s.index} className="bg-gray-900">
                {s.label} — {s.width}×{s.height}{s.isCurrent ? ' (this screen)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <Button variant="outline" size="sm" onClick={detectScreens} className="w-full">
            <ScanSearch className="w-4 h-4 mr-1" />
            Detect screens
          </Button>
        )
      )}
      <div className="flex gap-2">
        <Button
          variant={connected > 0 ? 'outline' : 'default'}
          size="sm"
          onClick={open}
          className="flex-1"
          title="Open the composition in its own window (for the projector)"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          {connected > 0 ? 'Show output' : 'Output window'}
        </Button>
        {connected > 0 && (
          <Button variant="outline" size="sm" onClick={closeOutputs} title="Close output windows">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {connected > 0
          ? `● ${connected} output${connected > 1 ? 's' : ''} live — editor audio muted`
          : 'No output window. Present (P) shows the output in this window.'}
      </p>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
