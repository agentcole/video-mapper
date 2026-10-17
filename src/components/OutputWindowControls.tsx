import React, { useState } from 'react';
import { ExternalLink, X, ScanSearch, MonitorPlay } from 'lucide-react';
import { Button } from './ui/button';
import { field, iconButton, option, segment, segmented } from './ui/theme';
import { useOutputStatus, closeOutputs } from '../output/controlSync';
import { liveStore, useLiveStore } from '../state/liveStore';
import { useProjectStore } from '../state/projectStore';
import { openScreenEditor, useScreenEditor } from '../state/screenEditor';
import {
  assignDisplay, detectDisplays, openOutput, supportsDisplaySelection, useDisplays,
} from '../output/outputWindow';

const BLOCKED = 'The browser blocked the output window — allow pop-ups for this site.';

// Output windows: the renderer, the screens (set up in the screen editor) and
// a window per screen — or one for the whole composition while there are no
// screens — on a chosen display (Chromium), whether they are connected.
export const OutputWindowControls: React.FC = () => {
  const screensOpen = useScreenEditor(s => s.open);
  const connected = useOutputStatus(s => s.connected);
  const live = useOutputStatus(s => s.screens);
  const screens = useProjectStore(s => s.screens);
  const displays = useDisplays(s => s.displays);
  const displayError = useDisplays(s => s.error);
  const assigned = useDisplays(s => s.assigned['']);
  const [error, setError] = useState<string | null>(null);
  const canSelectDisplay = supportsDisplaySelection();
  const renderer = useLiveStore(s => s.renderer);

  const open = (screenId: string | null) => {
    setError(null);
    if (!openOutput(screenId)) setError(BLOCKED);
  };

  // Several windows from one click: browsers may let only the first through
  const openAll = () => {
    setError(null);
    const blocked = screens.filter(s => !openOutput(s.id)).length;
    if (blocked > 0) setError(`The browser blocked ${blocked} output window${blocked > 1 ? 's' : ''} — open ${blocked > 1 ? 'them' : 'it'} one by one, or allow pop-ups for this site.`);
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

      <Button
        variant={screensOpen ? 'default' : 'outline'}
        size="sm"
        onClick={() => openScreenEditor(!screensOpen)}
        className="w-full"
        title="Screens: send parts of the composition to different projectors, warp each output"
      >
        <MonitorPlay />
        {screens.length > 0 ? `Screens (${screens.length})` : 'Screens'}
      </Button>

      {screens.length === 0 ? (
        <>
          {canSelectDisplay && (
            displays ? (
              <select
                value={assigned ?? ''}
                onChange={(e) => assignDisplay('', e.target.value || null)}
                className={`w-full ${field}`}
                title="Display for the output window"
              >
                <option value="" className={option}>Another display</option>
                {displays.map(d => (
                  <option key={d.index} value={d.label} className={option}>
                    {d.label} — {d.width}×{d.height}{d.isCurrent ? ' (this display)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void detectDisplays()} className="w-full">
                <ScanSearch />
                Detect displays
              </Button>
            )
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => open(null)}
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
        </>
      ) : (
        <div className="space-y-1">
          {screens.map(screen => (
            <div key={screen.id} className="flex items-center gap-1.5 text-xs bg-white/5 rounded px-2 py-1">
              <span className={live[screen.id] ? 'text-emerald-400' : 'text-gray-600'} title={live[screen.id] ? 'Output window live' : 'No output window'}>●</span>
              <span className="flex-1 min-w-0 truncate">{screen.name}</span>
              <span className="text-[10px] text-gray-500 tabular-nums">{screen.width}×{screen.height}</span>
              <button onClick={() => open(screen.id)} className={iconButton} title={`Open ${screen.name} in its own window`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openAll} className="flex-1" title="Open every screen's output window on its display">
              <ExternalLink />
              Open all
            </Button>
            {connected > 0 && (
              <Button variant="outline" size="sm" onClick={closeOutputs} title="Close output windows">
                <X />
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        {connected > 0
          ? <span className="text-emerald-300">● {connected} output{connected > 1 ? 's' : ''} live — editor audio muted</span>
          : 'No output window. Present (P) shows the output in this window.'}
      </p>
      {(error || displayError) && <p className="text-[11px] text-red-300">{error ?? displayError}</p>}
    </div>
  );
};
