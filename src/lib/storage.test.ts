import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { MediaFrame } from '../types';
import type { ProjectDocument } from '../state/projectStore';
import { DEFAULT_BACKGROUND, DEFAULT_COMPOSITION, DEFAULT_GRID } from './defaults';
import { clearAllMedia, getMedia, importMediaBlob } from './mediaStorage';
import { buildProjectPackage, importProjectFile, serializeProject } from './storage';

const frame = (id: string, mediaId?: string): MediaFrame => ({
  id, type: 'video', url: mediaId ? 'blob:session-url' : 'https://example.com/clip.mp4', mediaId,
  x: 0, y: 0, width: 320, height: 180, rotation: 0, shape: 'rectangle', textureMode: 'clip',
  loop: true, opacity: 1, zIndex: 0, playbackRate: 1, muted: true,
  blur: 0, brightness: 100, contrast: 100, grayscale: 0, saturate: 100, hueRotate: 0, invert: 0, sepia: 0,
  blendMode: 'normal', flipHorizontal: false, flipVertical: false, lockAspectRatio: true,
  contentScale: 1, contentOffsetX: 0, contentOffsetY: 0, perspectiveMode: false,
  perspectiveCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
  visible: true, testPattern: false, softEdge: { left: 0, right: 0, top: 0, bottom: 0 },
});

const doc = (frames: MediaFrame[]): ProjectDocument => ({
  frames, background: DEFAULT_BACKGROUND, grid: DEFAULT_GRID, composition: DEFAULT_COMPOSITION,
});

describe('serializeProject', () => {
  it('drops session blob URLs but keeps remote URLs and the name', () => {
    const data = serializeProject(doc([frame('a', 'media-1'), frame('b')]), 'Club night');
    expect(data.name).toBe('Club night');
    expect(data.frames[0].url).toBe('');
    expect(data.frames[1].url).toBe('https://example.com/clip.mp4');
  });
});

describe('project packages', () => {
  it('round-trips a project with its media through a zip', async () => {
    const bytes = new Uint8Array(4096).map((_, i) => i % 251);
    await importMediaBlob({ id: 'media-1', name: 'loop.mp4', type: 'video', mimeType: 'video/mp4', blob: new Blob([bytes], { type: 'video/mp4' }) });

    const { blob, missing } = await buildProjectPackage(doc([frame('a', 'media-1'), frame('b', 'media-gone')]), 'Club night');
    expect(missing).toEqual(['media-gone']);

    await clearAllMedia();
    expect(await getMedia('media-1')).toBeNull();

    const { project, name } = await importProjectFile(new File([blob], 'club.videomapper.zip'));
    expect(name).toBe('Club night');
    expect(project.frames.map(f => f.mediaId)).toEqual(['media-1', 'media-gone']);
    const restored = await getMedia('media-1');
    expect(restored?.name).toBe('loop.mp4');
    expect(new Uint8Array(await restored!.blob.arrayBuffer())).toEqual(bytes);
  });

  it('imports plain JSON project files', async () => {
    const json = JSON.stringify(serializeProject(doc([frame('a')])));
    const { project, name } = await importProjectFile(new File([json], 'my show.json'));
    expect(name).toBe('my show');
    expect(project.frames).toHaveLength(1);
  });

  it('rejects zips that are not project packages', async () => {
    const { blob } = await buildProjectPackage(doc([]), 'x');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Corrupt the manifest file name so project.json can't be found
    const text = new TextDecoder('latin1').decode(bytes).replaceAll('project.json', 'project.jsox');
    const broken = Uint8Array.from(text, c => c.charCodeAt(0));
    await expect(importProjectFile(new File([broken], 'x.zip'))).rejects.toThrow('project.json is missing');
  });
});
