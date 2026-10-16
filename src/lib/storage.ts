import { Zip, ZipDeflate, ZipPassThrough, unzip, strToU8, strFromU8, type Unzipped } from 'fflate';
import type { BackgroundSettings } from '../types';
import type { ProjectDocument } from '../state/projectStore';
import { allClips, mapClips, type Clip } from '../state/showModel';
import { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION, DEFAULT_TEMPO } from './defaults';
import { parseProjectData, PROJECT_VERSION, type ParsedProject, type PackageMediaEntry } from './projectSchema';
import { getMediaFile, importMediaBlob, importMediaRecords } from './mediaStorage';

// ---------------------------------------------------------------------------
// Project files: serialization (for the repository and exports), JSON export,
// project packages (zip: project.json + media files) and import of both.
// ---------------------------------------------------------------------------

export { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION, DEFAULT_TEMPO };

// A validated, migrated project (see projectSchema.ts)
export type LoadedProject = ParsedProject;

// Blob URLs are session-specific — media is re-resolved from its mediaId
const stripClipUrl = (clip: Clip): Clip =>
  clip.source.mediaId ? { ...clip, source: { ...clip.source, url: '' } } : clip;
const stripBackgroundUrl = (bg: BackgroundSettings): BackgroundSettings => (bg.mediaId ? { ...bg, url: '' } : bg);

export const serializeProject = (doc: ProjectDocument, name?: string) => ({
  ...(name ? { name } : {}),
  version: PROJECT_VERSION,
  timestamp: new Date().toISOString(),
  composition: doc.composition,
  grid: doc.grid,
  tempo: doc.tempo,
  background: stripBackgroundUrl(doc.background),
  surfaces: doc.surfaces,
  columns: doc.columns,
  layers: mapClips(doc, stripClipUrl).layers,
});

export type SerializedProject = ReturnType<typeof serializeProject>;

const safeFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'project';

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the download a moment to start before the URL dies
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Project only (media stays referenced by id) — small, for backups and sharing within one machine. */
export const exportProjectJson = (doc: ProjectDocument, name: string): void => {
  const blob = new Blob([JSON.stringify(serializeProject(doc, name), null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(name)}.json`);
};

// Every clip's media (not only the playing ones) + the background
const mediaIdsOf = (doc: ProjectDocument): string[] => [
  ...new Set([...allClips(doc).map(c => c.source.mediaId), doc.background.mediaId].filter((id): id is string => Boolean(id))),
];

/**
 * A portable project package: project.json plus every referenced media file
 * (library or linked folder), streamed into a zip without base64 overhead.
 * Returns the media ids that couldn't be read (deleted, folder disconnected).
 */
export async function buildProjectPackage(doc: ProjectDocument, name: string): Promise<{ blob: Blob; missing: string[] }> {
  const parts: Uint8Array[] = [];
  let resolveDone!: () => void;
  let rejectDone!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      rejectDone(error);
      return;
    }
    parts.push(chunk);
    if (final) resolveDone();
  });

  const mediaFiles: PackageMediaEntry[] = [];
  const missing: string[] = [];
  for (const [index, id] of mediaIdsOf(doc).entries()) {
    const file = await getMediaFile(id);
    if (!file) {
      missing.push(id);
      continue;
    }
    const path = `media/${index + 1}-${safeFileName(file.name)}`;
    // Video and images are already compressed — store them as they are
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    const reader = file.blob.stream().getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      entry.push(value, false);
    }
    entry.push(new Uint8Array(0), true);
    mediaFiles.push({ id, name: file.name, type: file.type, mimeType: file.mimeType, path });
  }

  const manifest = new ZipDeflate('project.json', { level: 6 });
  zip.add(manifest);
  manifest.push(strToU8(JSON.stringify({ ...serializeProject(doc, name), mediaFiles }, null, 2)), true);
  zip.end();
  await finished;

  return { blob: new Blob(parts as BlobPart[], { type: 'application/zip' }), missing };
}

export async function exportProjectPackage(doc: ProjectDocument, name: string): Promise<{ missing: string[] }> {
  const { blob, missing } = await buildProjectPackage(doc, name);
  downloadBlob(blob, `${safeFileName(name)}.videomapper.zip`);
  return { missing };
}

const isZipFile = async (file: Blob): Promise<boolean> => {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
};

const unzipAsync = (data: Uint8Array): Promise<Unzipped> =>
  new Promise((resolve, reject) => unzip(data, (error, files) => (error ? reject(error) : resolve(files))));

export interface ImportedProjectFile {
  project: LoadedProject;
  name: string;
}

/**
 * Read a project file — a package (zip) or JSON (incl. the old base64
 * export) — and restore its media into the library under the original ids.
 */
export async function importProjectFile(file: File): Promise<ImportedProjectFile> {
  const baseName = file.name.replace(/(\.videomapper)?\.(zip|json)$/i, '') || 'Imported project';

  if (await isZipFile(file)) {
    const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
    const manifest = files['project.json'];
    if (!manifest) throw new Error('Not a Video Mapper package (project.json is missing)');
    let raw: unknown;
    try {
      raw = JSON.parse(strFromU8(manifest));
    } catch {
      throw new Error('project.json in the package is not valid JSON');
    }
    const project = parseProjectData(raw);
    for (const entry of project.mediaFiles ?? []) {
      const data = files[entry.path];
      if (!data) {
        project.warnings.push(`Media "${entry.name}" is missing from the package.`);
        continue;
      }
      await importMediaBlob({ ...entry, blob: new Blob([data as BlobPart], { type: entry.mimeType }) });
    }
    return { project, name: project.name ?? baseName };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('Failed to parse project file');
  }
  const project = parseProjectData(raw);
  if (project.media?.length) await importMediaRecords(project.media);
  return { project, name: project.name ?? baseName };
}

export const generateFrameId = (): string => {
  return `frame-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
