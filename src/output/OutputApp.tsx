import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { projectStore, useProjectStore } from '../state/projectStore';
import { allClips, type ClipSource } from '../state/showModel';
import { usePreload } from '../render/preload';
import { crossfadeGain } from '../state/transitions';
import { loadUserEffects } from '../effects/library';
import { publishAudio } from '../audio/audioBus';
import { liveStore, useLiveStore, outputGainOf } from '../state/liveStore';
import { getCurrentProjectId, getProject } from '../lib/projectRepository';
import { parseProjectData } from '../lib/projectSchema';
import { resolveMediaUrls } from '../lib/mediaStorage';
import { FrameContent } from '../components/FrameContent';
import { BackgroundLayer, GridOverlay } from '../components/StageLayers';
import { TestCard } from '../components/TestCard';
import { ScreenDom } from '../components/ScreenDom';
import { GpuStage } from '../render/GpuStage';
import { OUTPUT_CHANNEL, OUTPUT_QUERY_PARAM, HEARTBEAT_INTERVAL_MS, type OutputMessage } from './protocol';

// ---------------------------------------------------------------------------
// Output window: the composition only — no editor UI, ever. It mirrors the
// editor over a BroadcastChannel, and starts from the autosaved project so it
// also works on its own (or keeps the last picture if the editor goes away).
// It starts from the editor's open project as last saved.
// With ?output=<screen id> it shows that screen: its slices of the
// composition, at the screen's resolution (docs/design/screens.md).
// ---------------------------------------------------------------------------

const CURSOR_IDLE_MS = 2000;
const HINT_MS = 5000;

/** Mirror the editor; true once there is a document (saved or live). */
const useOutputSync = (screenId: string | null): boolean => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void loadUserEffects();
    // Live state from the editor always wins over the saved project
    let receivedLiveState = false;
    const projectId = getCurrentProjectId();
    if (projectId) {
      getProject(projectId)
        .then(record => {
          if (receivedLiveState || record?.data == null) return;
          const { surfaces, layers, columns, background, grid, composition, tempo, effects, macros, screens } = parseProjectData(record.data);
          projectStore.getState().replaceDocument({ surfaces, layers, columns, background, grid, composition, tempo, effects, macros, screens });
          setReady(true);
        })
        .catch(error => console.warn('Could not load the saved project for the output:', error));
    }
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(OUTPUT_CHANNEL);
    const outputId = crypto.randomUUID();
    const send = (message: OutputMessage) => channel.postMessage(message);

    channel.onmessage = (event: MessageEvent<OutputMessage>) => {
      const message = event.data;
      if (message.type === 'state') {
        receivedLiveState = true;
        projectStore.getState().replaceDocument(message.snapshot.doc);
        liveStore.setState(message.snapshot.live);
        setReady(true);
      } else if (message.type === 'audio') {
        publishAudio(message.snapshot);
      } else if (message.type === 'control-ready') {
        send({ type: 'hello', outputId, screenId });
      } else if (message.type === 'close-outputs') {
        window.close();
      }
    };
    send({ type: 'hello', outputId, screenId });
    const heartbeat = setInterval(() => send({ type: 'heartbeat', outputId, screenId }), HEARTBEAT_INTERVAL_MS);
    const sayBye = () => send({ type: 'bye', outputId });
    window.addEventListener('pagehide', sayBye);

    return () => {
      sayBye();
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', sayBye);
      channel.close();
    };
  }, [screenId]);
  return ready;
};

// Blob URLs belong to the window that made them — resolve stored media here
const useResolvedMediaUrls = (mediaIds: string[]) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const missing = mediaIds.filter(id => !(id in urls));
  const missingKey = missing.join('|');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    resolveMediaUrls(missingKey.split('|'))
      .then(map => {
        if (!cancelled) setUrls(prev => ({ ...prev, ...Object.fromEntries(map) }));
      })
      .catch(error => console.error('Failed to resolve media for output:', error));
    return () => {
      cancelled = true;
    };
  }, [missingKey]);
  return urls;
};

// Keep the display awake while the output is visible
const useWakeLock = () => {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen')
        .then(lock => { sentinel = lock; })
        .catch(() => {});
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      sentinel?.release().catch(() => {});
    };
  }, []);
};

export const OutputApp: React.FC = () => {
  const screenId = useMemo(() => new URLSearchParams(window.location.search).get(OUTPUT_QUERY_PARAM) || null, []);
  const ready = useOutputSync(screenId);
  useWakeLock();

  const frames = useProjectStore(s => s.frames);
  const layers = useProjectStore(s => s.layers);
  const background = useProjectStore(s => s.background);
  const grid = useProjectStore(s => s.grid);
  const composition = useProjectStore(s => s.composition);
  const masterOpacity = useLiveStore(s => s.masterOpacity);
  const blackout = useLiveStore(s => s.blackout);
  const showTestCard = useLiveStore(s => s.showTestCard);
  const playback = useLiveStore(s => s.playback);
  const renderer = useLiveStore(s => s.renderer);
  const layerTriggers = useLiveStore(s => s.layerTriggers);
  const crossfader = useLiveStore(s => s.crossfader);
  const clockOrigin = useLiveStore(s => s.clockOrigin);
  const timeOrigin = useLiveStore(s => s.timeOrigin);
  const bpm = useProjectStore(s => s.tempo.bpm);
  const compositionEffects = useProjectStore(s => s.effects);
  const macros = useProjectStore(s => s.macros);
  const screens = useProjectStore(s => s.screens);
  const screen = screenId ? screens.find(s => s.id === screenId) ?? null : null;
  // A screen that isn't in the project (deleted): black, never the wrong picture
  const missingScreen = screenId !== null && !screen;
  // What this window shows: a screen, or the whole composition
  const space = screen ?? composition;
  const [gpuFailed, setGpuFailed] = useState(false);
  const useGpu = renderer === 'gpu' && !gpuFailed;
  const outputGain = outputGainOf({ masterOpacity, blackout });

  // Every clip's media, not only the playing ones: a trigger must not wait
  // for IndexedDB
  const mediaIds = [...allClips({ layers }).map(c => c.source.mediaId), background.mediaId]
    .filter((id): id is string => Boolean(id));
  const mediaUrls = useResolvedMediaUrls(mediaIds);
  const urlOf = (item: { mediaId?: string; url?: string }) =>
    item.mediaId ? mediaUrls[item.mediaId] ?? '' : item.url ?? '';
  const clipUrlOf = useCallback(
    (source: ClipSource) => (source.mediaId ? mediaUrls[source.mediaId] ?? '' : source.url),
    [mediaUrls],
  );
  const { preload, forFrame: preloadFor } = usePreload(clipUrlOf);

  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [cursorIdle, setCursorIdle] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const screenName = screen?.name;
  useEffect(() => {
    document.title = `Video Mapper — ${screenName ?? 'Output'}`;
  }, [screenName]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Hide the cursor and the fullscreen hint when the mouse rests
  useEffect(() => {
    let cursorTimer = setTimeout(() => setCursorIdle(true), CURSOR_IDLE_MS);
    let hintTimer = setTimeout(() => setShowHint(false), HINT_MS);
    const onMove = () => {
      setCursorIdle(false);
      setShowHint(true);
      clearTimeout(cursorTimer);
      clearTimeout(hintTimer);
      cursorTimer = setTimeout(() => setCursorIdle(true), CURSOR_IDLE_MS);
      hintTimer = setTimeout(() => setShowHint(false), HINT_MS);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearTimeout(cursorTimer);
      clearTimeout(hintTimer);
    };
  }, []);

  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(error => console.warn('Fullscreen failed:', error));
    }
  };

  // F: fullscreen. B: blackout (forwarded to the editor, which owns live state)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      } else if (e.key === 'b' || e.key === 'B') {
        if (typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(OUTPUT_CHANNEL);
        channel.postMessage({ type: 'toggle-blackout' } satisfies OutputMessage);
        channel.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scale = Math.min(viewport.w / space.width, viewport.h / space.height) || 1;
  const offsetX = (viewport.w - space.width * scale) / 2;
  const offsetY = (viewport.h - space.height * scale) / 2;

  // The composition with the CSS renderer (once, or once per slice of a screen)
  const compositionDom = (audible: boolean) => (
    <div className="absolute inset-0" style={{ opacity: masterOpacity }}>
      <BackgroundLayer
        background={background}
        url={urlOf(background)}
        outputGain={audible ? outputGain : 0}
        playback={playback}
      />
      {frames.filter(f => f.visible !== false).map(frame => (
        <FrameContent
          key={frame.id}
          frame={frame}
          url={urlOf(frame)}
          playback={playback}
          outputGain={audible ? outputGain : 0}
          showPlaceholder={false}
          preload={preloadFor(frame)}
          startSeq={frame.layerId ? layerTriggers[frame.layerId] ?? 0 : undefined}
          gain={crossfadeGain(frame.crossfade, crossfader)}
          bpm={bpm}
        />
      ))}
    </div>
  );

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-black relative select-none"
      style={{ cursor: cursorIdle ? 'none' : 'default' }}
      onClick={enterFullscreen}
    >
      <div
        className="absolute bg-black"
        style={{
          width: space.width,
          height: space.height,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {missingScreen ? null : useGpu ? (
          <GpuStage
            scene={{
              frames: frames.filter(f => f.visible !== false).map(f => ({ ...f, url: urlOf(f) })),
              bpm,
              clockOrigin,
              timeOrigin,
              effects: compositionEffects,
              crossfader,
              macros: macros.map(m => m.value),
              background: { ...background, url: urlOf(background) },
              composition,
              screen,
              masterOpacity,
              outputGain,
              playback,
              showPlaceholders: false,
              preload,
              layerTriggers,
            }}
            pixelsPerUnit={scale * window.devicePixelRatio}
            onUnavailable={(reason) => {
              // Never leave the projector black: fall back to the CSS renderer
              console.error(`${reason} — output falls back to the CSS renderer`);
              setGpuFailed(true);
            }}
          />
        ) : screen ? (
          <ScreenDom screen={screen} composition={composition} renderComposition={compositionDom} />
        ) : (
          compositionDom(true)
        )}

        {/* The grid is in composition px — not shown on a screen */}
        {!screenId && grid.show && grid.showInPresentation && <GridOverlay grid={grid} />}

        {/* On a screen the test card is the screen's: its name and resolution, for the projector */}
        {showTestCard && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 550 }}>
            <TestCard
              width={space.width}
              height={space.height}
              label={screen ? `${screen.name} · ${screen.width} × ${screen.height}` : `${composition.width} × ${composition.height}`}
            />
          </div>
        )}

        {blackout && (
          <div className="absolute inset-0 bg-black pointer-events-none" style={{ zIndex: 950 }} />
        )}
      </div>

      {/* Only while the mouse moves: the projector itself stays black */}
      {missingScreen && ready && showHint && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm pointer-events-none">
          This screen is no longer in the project
        </div>
      )}

      {!isFullscreen && showHint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md text-white/90 text-xs rounded-lg shadow-2xl px-3 py-2 pointer-events-none">
          Click or press F for fullscreen · B blackout
        </div>
      )}
    </div>
  );
};
