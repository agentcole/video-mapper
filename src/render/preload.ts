import { useMemo, useState } from 'react';
import type { MediaFrame } from '../types';
import { preloadClips } from '../state/deck';
import { useProjectStore } from '../state/projectStore';
import { useLiveStore } from '../state/liveStore';
import type { ClipSource, ShowDocument } from '../state/showModel';
import type { PreloadMedia } from './types';

// ---------------------------------------------------------------------------
// What a renderer should preload: the clips the launcher may start next
// (cued column, clip under the pointer) on layers that are actually visible.
// ---------------------------------------------------------------------------

export const preloadMedia = (
  show: ShowDocument,
  cuedColumn: number | null,
  preloadClipId: string | null,
  urlOf: (source: ClipSource) => string,
): PreloadMedia[] => {
  const visibleLayers = new Set(show.surfaces.filter(s => s.visible).map(s => s.layerId));
  const result: PreloadMedia[] = [];
  for (const { layerId, clip } of preloadClips(show, cuedColumn, preloadClipId)) {
    if (!visibleLayers.has(layerId)) continue;
    const url = urlOf(clip.source);
    if (!url) continue;
    result.push({
      clipId: clip.id,
      layerId,
      url,
      type: clip.source.type,
      loop: clip.loop,
      muted: clip.muted,
      playbackRate: clip.playbackRate,
    });
  }
  return result;
};

const samePreload = (a: PreloadMedia, b: PreloadMedia) =>
  a.clipId === b.clipId && a.url === b.url && a.type === b.type && a.loop === b.loop &&
  a.muted === b.muted && a.playbackRate === b.playbackRate;

export const NO_PRELOAD: PreloadMedia[] = [];

/**
 * The preloads of this window, all together (GPU) and per layer (CSS, one
 * list per surface). Lists that didn't change keep their identity, so
 * memoized frames don't re-render on unrelated edits.
 */
export function usePreload(urlOf: (source: ClipSource) => string): {
  preload: PreloadMedia[];
  forFrame: (frame: MediaFrame) => PreloadMedia[];
} {
  const surfaces = useProjectStore(s => s.surfaces);
  const layers = useProjectStore(s => s.layers);
  const columns = useProjectStore(s => s.columns);
  const cuedColumn = useLiveStore(s => s.cuedColumn);
  const preloadClipId = useLiveStore(s => s.preloadClipId);

  const computed = useMemo(
    () => preloadMedia({ surfaces, layers, columns }, cuedColumn, preloadClipId, urlOf),
    [surfaces, layers, columns, cuedColumn, preloadClipId, urlOf],
  );
  // Most edits don't change what to preload — keep the previous list then
  const [preload, setPreload] = useState(computed);
  const unchanged = preload.length === computed.length && preload.every((p, i) => samePreload(p, computed[i]));
  if (!unchanged) setPreload(computed);

  return useMemo(() => {
    const byLayer = new Map<string, PreloadMedia[]>();
    for (const p of preload) byLayer.set(p.layerId, [...(byLayer.get(p.layerId) ?? []), p]);
    return {
      preload,
      forFrame: (frame: MediaFrame) => (frame.layerId ? byLayer.get(frame.layerId) ?? NO_PRELOAD : NO_PRELOAD),
    };
  }, [preload]);
}
