import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Play, Square, Download, Copy, FileVideo } from 'lucide-react';
import type { MediaFrame, StoredMedia } from '../types';
import { FrameContent } from '../components/FrameContent';
import { Button } from '../components/ui/button';
import { getAllMedia, getMediaObjectUrl } from '../lib/mediaStorage';
import { generateTestClip } from './testClip';
import { getEnvironmentInfo, type EnvironmentInfo } from './environment';
import {
  estimateRefreshInterval, isStable, maxStableLayers, summarizeFrameIntervals, type StepResult,
} from './stats';

// ---------------------------------------------------------------------------
// Video layer benchmark (roadmap 1.6): how many corner-pinned video layers
// does this machine + browser play smoothly? Layers render through the same
// FrameContent path as the editor and output window.
// ---------------------------------------------------------------------------

const STAGE = { width: 1920, height: 1080 };
const LAYER_STEPS = [1, 2, 4, 6, 8, 12, 16];
const WARMUP_MS = 1500;
const MEASURE_MS = 4000;
const READY_TIMEOUT_MS = 10000;

interface Source {
  url: string;
  label: string;
  fps: number | null; // known for generated clips
}

const PLAYBACK_IDLE = { command: null, seq: 0 } as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// rAF intervals over a time window
const measureFrames = (durationMs: number): Promise<number[]> => new Promise(resolve => {
  const intervals: number[] = [];
  let last = 0;
  let end = 0;
  const tick = (t: number) => {
    if (last === 0) {
      last = t;
      end = t + durationMs;
    } else {
      intervals.push(t - last);
      last = t;
    }
    if (t < end || end === 0) requestAnimationFrame(tick);
    else resolve(intervals);
  };
  requestAnimationFrame(tick);
});

// Presented video frames per element over the measurement window
const startVideoCounters = (videos: HTMLVideoElement[]) => videos.map(video => {
  let first: number | null = null;
  let latest = 0;
  let active = true;
  const quality = video.getVideoPlaybackQuality?.();
  const dropped0 = quality?.droppedVideoFrames ?? 0;
  const total0 = quality?.totalVideoFrames ?? 0;
  const onFrame: VideoFrameRequestCallback = (_now, meta) => {
    if (!active) return;
    first ??= meta.presentedFrames;
    latest = meta.presentedFrames;
    video.requestVideoFrameCallback(onFrame);
  };
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame);
  return () => {
    active = false;
    const q = video.getVideoPlaybackQuality?.();
    const total = (q?.totalVideoFrames ?? 0) - total0;
    return {
      // Fall back to decoded frames where rVFC is missing
      presented: first === null ? total : latest - first,
      dropped: (q?.droppedVideoFrames ?? 0) - dropped0,
      total,
    };
  };
});

const waitForVideos = async (container: HTMLElement, count: number) => {
  const deadline = performance.now() + READY_TIMEOUT_MS;
  while (performance.now() < deadline) {
    const videos = [...container.querySelectorAll('video')];
    if (videos.length === count && videos.every(v => v.readyState >= 3 && !v.paused)) return videos;
    await sleep(100);
  }
  throw new Error('Videos did not start playing (unsupported codec or file?)');
};

// Layers in a grid, each with a mild corner-pin warp like a mapped surface
const makeLayers = (count: number, url: string): MediaFrame[] => {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = STAGE.width / cols;
  const cellH = STAGE.height / rows;
  return Array.from({ length: count }, (_, i) => {
    const w = cellW * 0.9;
    const h = cellH * 0.9;
    const k = Math.min(w, h) * 0.08;
    return {
      id: `bench-${i}`,
      type: 'video',
      url,
      x: (i % cols) * cellW + cellW * 0.05,
      y: Math.floor(i / cols) * cellH + cellH * 0.05,
      width: w,
      height: h,
      rotation: 0,
      shape: i % 3 === 2 ? 'circle' : 'rectangle',
      textureMode: 'clip',
      loop: true,
      opacity: 1,
      zIndex: i,
      playbackRate: 1,
      muted: true,
      blur: 0, brightness: 100, contrast: 100, grayscale: 0, saturate: 100,
      hueRotate: 0, invert: 0, sepia: 0,
      blendMode: 'normal',
      flipHorizontal: false,
      flipVertical: false,
      lockAspectRatio: false,
      contentScale: 1, contentOffsetX: 0, contentOffsetY: 0,
      perspectiveMode: true,
      perspectiveCorners: { tl: { x: k, y: 0 }, tr: { x: -k, y: k / 2 }, br: { x: 0, y: 0 }, bl: { x: k / 2, y: -k / 2 } },
      visible: true,
      testPattern: false,
      softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
    };
  });
};

export const BenchmarkApp: React.FC = () => {
  const [env, setEnv] = useState<EnvironmentInfo | null>(null);
  const [library, setLibrary] = useState<StoredMedia[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [status, setStatus] = useState('Pick a source to start.');
  const [running, setRunning] = useState(false);
  const [layerCount, setLayerCount] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [refreshMs, setRefreshMs] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [fullscreenRun, setFullscreenRun] = useState(true);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);
  const ownedUrlRef = useRef<string | null>(null); // object URL this page created

  useEffect(() => {
    document.title = 'Video Mapper — Benchmark';
    getEnvironmentInfo().then(setEnv);
    getAllMedia().then(media => setLibrary(media.filter(m => m.type === 'video'))).catch(() => {});
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    const onFullscreenChange = () => setStageFullscreen(document.fullscreenElement === stageWrapperRef.current);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const selectSource = (next: Source, owned: boolean) => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
    ownedUrlRef.current = owned ? next.url : null;
    setSource(next);
    setResults([]);
  };

  const layers = useMemo(() => (source ? makeLayers(layerCount, source.url) : []), [layerCount, source]);

  const chooseGeneratedClip = async (width: number, height: number) => {
    setStatus(`Recording a ${width}×${height} test clip…`);
    try {
      const clip = await generateTestClip(width, height, 4, 30, f => setStatus(`Recording test clip… ${Math.round(f * 100)}%`));
      selectSource({ url: URL.createObjectURL(clip.blob), label: `Generated ${width}×${height} 30 fps (${clip.mimeType})`, fps: 30 }, true);
      setStatus('Test clip ready.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const chooseFile = (file: File) => {
    selectSource({ url: URL.createObjectURL(file), label: `${file.name} (${file.type || 'unknown type'})`, fps: null }, true);
    setStatus('File ready.');
  };

  const chooseLibraryMedia = (media: StoredMedia) => {
    // Library URLs are session-wide (shared cache) — not owned here
    selectSource({ url: getMediaObjectUrl(media), label: `${media.name} (${media.mimeType})`, fps: null }, false);
    setStatus('Media ready.');
  };

  const run = async () => {
    if (!source || !stageRef.current) return;
    // Fullscreen has to be requested synchronously inside the click
    if (fullscreenRun) stageWrapperRef.current?.requestFullscreen().catch(() => {});
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    try {
      setLayerCount(0);
      setStatus('Measuring the display refresh rate…');
      await sleep(500);
      const refresh = estimateRefreshInterval(await measureFrames(1500));
      setRefreshMs(refresh);

      const collected: StepResult[] = [];
      let unstableInARow = 0;
      for (const count of LAYER_STEPS) {
        if (cancelRef.current) break;
        setLayerCount(count);
        setStatus(`${count} layer${count > 1 ? 's' : ''}: starting videos…`);
        const videos = await waitForVideos(stageRef.current, count);
        setStatus(`${count} layer${count > 1 ? 's' : ''}: warming up…`);
        await sleep(WARMUP_MS);
        setStatus(`${count} layer${count > 1 ? 's' : ''}: measuring…`);
        const stopCounters = startVideoCounters(videos);
        const intervals = await measureFrames(MEASURE_MS);
        const counts = stopCounters.map(stop => stop());

        const seconds = MEASURE_MS / 1000;
        const display = summarizeFrameIntervals(intervals, refresh);
        const videoFps = counts.reduce((sum, c) => sum + c.presented, 0) / counts.length / seconds;
        const total = counts.reduce((sum, c) => sum + c.total, 0);
        const dropped = counts.reduce((sum, c) => sum + c.dropped, 0);
        const droppedVideoPct = total > 0 ? (dropped / total) * 100 : 0;
        // Unknown source fps: the single-layer step is the reference
        const sourceFps = source.fps ?? collected[0]?.videoFps ?? videoFps;
        const step: StepResult = {
          layers: count,
          display,
          videoFps,
          droppedVideoPct,
          stable: isStable(display, refresh, videoFps, sourceFps, droppedVideoPct),
        };
        collected.push(step);
        setResults([...collected]);
        unstableInARow = step.stable ? 0 : unstableInARow + 1;
        if (unstableInARow >= 2) break; // clearly past the limit
      }
      setStatus(cancelRef.current ? 'Stopped.' : 'Done.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLayerCount(0);
      setRunning(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };

  const maxStable = maxStableLayers(results);
  const report = {
    date: new Date().toISOString(),
    source: source?.label,
    stage: `${STAGE.width}×${STAGE.height}`,
    refreshHz: refreshMs ? Math.round(1000 / refreshMs) : null,
    maxStableLayers: maxStable,
    results,
    environment: env,
  };
  const summary = results.length > 0
    ? `Video Mapper benchmark: ${maxStable} stable layer(s) — ${source?.label}, ${env?.gpu ?? 'unknown GPU'}, ${navigator.userAgent}`
    : '';

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-mapper-benchmark-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fullscreen: the stage fills the screen like the output window would;
  // otherwise a preview the width of the page
  const previewW = Math.min(viewport.w - 32, 1024);
  const scale = stageFullscreen
    ? Math.min(viewport.w / STAGE.width, viewport.h / STAGE.height)
    : previewW / STAGE.width;

  return (
    <div className="w-screen h-screen overflow-auto bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <header className="flex items-center gap-2">
          <Gauge className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold">Video layer benchmark</h1>
          <a href="./" className="ml-auto text-sm text-gray-400 hover:text-white underline">Back to editor</a>
        </header>
        <p className="text-sm text-gray-400">
          Plays 1–16 corner-pinned video layers on a {STAGE.width}×{STAGE.height} stage — the same render path as the
          editor and output window — and measures display frame rate, stutter and dropped video frames. Close other
          tabs and run it on the show machine, with the browser window on the projector screen if possible.
        </p>

        <section className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={running} onClick={() => chooseGeneratedClip(1920, 1080)}>
            <FileVideo className="w-4 h-4 mr-1" /> Test clip 1080p
          </Button>
          <Button size="sm" variant="outline" disabled={running} onClick={() => chooseGeneratedClip(3840, 2160)}>
            <FileVideo className="w-4 h-4 mr-1" /> Test clip 4K
          </Button>
          <label className={`inline-flex items-center text-sm px-3 py-1.5 rounded-md border border-gray-600 ${running ? 'opacity-50' : 'cursor-pointer hover:bg-white/10'}`}>
            Your video file…
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={running}
              onChange={(e) => e.target.files?.[0] && chooseFile(e.target.files[0])}
            />
          </label>
          {library.length > 0 && (
            <select
              className="bg-white/10 rounded px-2 py-1.5 text-sm"
              disabled={running}
              value=""
              onChange={(e) => {
                const media = library.find(m => m.id === e.target.value);
                if (media) chooseLibraryMedia(media);
              }}
            >
              <option value="" className="bg-gray-900">From media library…</option>
              {library.map(m => <option key={m.id} value={m.id} className="bg-gray-900">{m.name}</option>)}
            </select>
          )}
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-gray-300">
              <input type="checkbox" checked={fullscreenRun} disabled={running} onChange={(e) => setFullscreenRun(e.target.checked)} />
              Fullscreen while running
            </label>
            {running ? (
              <Button size="sm" variant="destructive" onClick={() => { cancelRef.current = true; }}>
                <Square className="w-4 h-4 mr-1" /> Stop
              </Button>
            ) : (
              <Button size="sm" disabled={!source} onClick={run}>
                <Play className="w-4 h-4 mr-1" /> Run benchmark
              </Button>
            )}
          </div>
        </section>
        <p className="text-sm">
          <span className="text-gray-400">Source:</span> {source?.label ?? '—'} · <span className="text-gray-400">Status:</span> {status}
        </p>

        <div
          ref={stageWrapperRef}
          className="relative bg-black overflow-hidden rounded"
          style={stageFullscreen ? undefined : { width: previewW, height: STAGE.height * scale }}
        >
          <div
            ref={stageRef}
            className="absolute"
            style={{
              width: STAGE.width,
              height: STAGE.height,
              left: stageFullscreen ? (viewport.w - STAGE.width * scale) / 2 : 0,
              top: stageFullscreen ? (viewport.h - STAGE.height * scale) / 2 : 0,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            {layers.map(frame => (
              <FrameContent key={frame.id} frame={frame} playback={PLAYBACK_IDLE} outputGain={0} showPlaceholder={false} />
            ))}
          </div>
          {stageFullscreen && (
            <p className="absolute bottom-3 left-3 text-sm bg-black/70 rounded px-2 py-1">{status}</p>
          )}
        </div>

        {results.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className={`text-lg font-semibold ${maxStable > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {maxStable > 0 ? `Stable up to ${maxStable} layer${maxStable > 1 ? 's' : ''}` : 'Not stable with a single layer'}
              </p>
              <span className="text-sm text-gray-400">display {refreshMs ? Math.round(1000 / refreshMs) : '?'} Hz</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(summary)}>
                  <Copy className="w-4 h-4 mr-1" /> Copy summary
                </Button>
                <Button size="sm" variant="outline" onClick={downloadReport}>
                  <Download className="w-4 h-4 mr-1" /> Report (JSON)
                </Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-left">
                <tr>
                  <th className="py-1">Layers</th>
                  <th>Display fps</th>
                  <th>p95 / p99 frame (ms)</th>
                  <th>Stutter frames</th>
                  <th>Video fps / layer</th>
                  <th>Dropped video frames</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.layers} className="border-t border-white/10">
                    <td className="py-1">{r.layers}</td>
                    <td>{r.display.fps.toFixed(1)}</td>
                    <td>{r.display.p95.toFixed(1)} / {r.display.p99.toFixed(1)}</td>
                    <td>{r.display.longFrames}</td>
                    <td>{r.videoFps.toFixed(1)}</td>
                    <td>{r.droppedVideoPct.toFixed(1)} %</td>
                    <td className={r.stable ? 'text-emerald-400' : 'text-red-400'}>{r.stable ? 'stable' : 'unstable'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500">
              Stable = display ≥ 95 % of its refresh rate, p99 frame ≤ 2 refreshes, video keeps ≥ 95 % of its frame
              rate and drops &lt; 1 % of frames. Results depend on codec, resolution and bitrate — benchmark your real show files.
            </p>
          </section>
        )}

        {env && (
          <section className="text-sm space-y-2">
            <h2 className="font-semibold text-gray-300">This machine</h2>
            <p className="text-gray-400">
              GPU: {env.gpu ?? 'unknown'} · CPU threads: {env.cores ?? '?'} · Memory: {env.memoryGB ? `≥ ${env.memoryGB} GB` : '?'} ·
              Screen: {env.screen} @{env.devicePixelRatio}x
            </p>
            {env.codecs.length > 0 && (
              <table className="text-sm">
                <thead className="text-gray-400 text-left">
                  <tr><th className="pr-6">Codec (1080p30)</th><th className="pr-6">Decodes</th><th className="pr-6">Smooth</th><th>Power-efficient (≈ hardware)</th></tr>
                </thead>
                <tbody>
                  {env.codecs.map(c => (
                    <tr key={c.name}>
                      <td className="pr-6">{c.name}</td>
                      <td>{c.supported ? 'yes' : 'no'}</td>
                      <td>{c.smooth ? 'yes' : 'no'}</td>
                      <td>{c.powerEfficient ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
