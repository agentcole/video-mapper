import type { MediaType } from '../types';
import { promisify, transactionDone } from './idb';
import { getProjectDB, FOLDERS } from './projectRepository';

// ---------------------------------------------------------------------------
// Linked media folders (File System Access API — Chromium). Media is played
// straight from a folder on disk: no copy into browser storage, no size
// limit. Folder handles are kept in IndexedDB; Chromium keeps the read
// permission for installed apps, otherwise the user re-grants it with one
// click ("Reconnect").
//
// Media ids: `folder:<folderId>:<relative/path.mp4>`
// ---------------------------------------------------------------------------

const PREFIX = 'folder:';

export const isFolderMediaId = (id: string): boolean => id.startsWith(PREFIX);

export const folderMediaId = (folderId: string, path: string): string => `${PREFIX}${folderId}:${path}`;

export const parseFolderMediaId = (id: string): { folderId: string; path: string } | null => {
  if (!isFolderMediaId(id)) return null;
  const rest = id.slice(PREFIX.length);
  const split = rest.indexOf(':');
  if (split < 0) return null;
  return { folderId: rest.slice(0, split), path: rest.slice(split + 1) };
};

const VIDEO_EXTENSIONS: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg',
};
const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
};

export const mediaKindOf = (fileName: string): { type: MediaType; mimeType: string } | null => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext in VIDEO_EXTENSIONS) return { type: 'video', mimeType: VIDEO_EXTENSIONS[ext] };
  if (ext in IMAGE_EXTENSIONS) return { type: 'image', mimeType: IMAGE_EXTENSIONS[ext] };
  return null;
};

// Chromium-only permission methods (not in lib.dom)
type PermissionedHandle = FileSystemHandle & {
  queryPermission?: (desc: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: 'read' }) => Promise<PermissionState>;
};
type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker: (options?: { mode?: 'read'; id?: string }) => Promise<FileSystemDirectoryHandle>;
};

export interface LinkedFolder {
  id: string;
  name: string;
  linkedAt: number;
  handle: FileSystemDirectoryHandle;
}

export interface FolderMediaFile {
  id: string; // folder media id
  name: string;
  path: string;
  type: MediaType;
  mimeType: string;
  size: number;
  lastModified: number;
  file: File;
}

export const supportsLinkedFolders = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Let the user pick a folder and remember it. */
export async function linkFolder(): Promise<LinkedFolder> {
  const handle = await (window as unknown as WindowWithDirectoryPicker).showDirectoryPicker({ mode: 'read', id: 'video-mapper-media' });
  const folder: LinkedFolder = { id: crypto.randomUUID(), name: handle.name, linkedAt: Date.now(), handle };
  const db = await getProjectDB();
  const tx = db.transaction(FOLDERS, 'readwrite');
  tx.objectStore(FOLDERS).put(folder);
  await transactionDone(tx);
  return folder;
}

export async function listLinkedFolders(): Promise<LinkedFolder[]> {
  const db = await getProjectDB();
  const all = await promisify(db.transaction(FOLDERS).objectStore(FOLDERS).getAll() as IDBRequest<LinkedFolder[]>);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function unlinkFolder(id: string): Promise<void> {
  const db = await getProjectDB();
  const tx = db.transaction(FOLDERS, 'readwrite');
  tx.objectStore(FOLDERS).delete(id);
  await transactionDone(tx);
}

/** Current read permission; with `request` it asks (needs a user gesture). */
export async function folderPermission(folder: LinkedFolder, request = false): Promise<PermissionState> {
  const handle = folder.handle as PermissionedHandle;
  if (!handle.queryPermission) return 'granted'; // browsers without the permission model
  const state = await handle.queryPermission({ mode: 'read' });
  if (state === 'granted' || !request || !handle.requestPermission) return state;
  return handle.requestPermission({ mode: 'read' });
}

/** All media files in a folder (recursively), sorted by path. */
export async function scanFolder(folder: LinkedFolder, maxFiles = 5000): Promise<FolderMediaFile[]> {
  const found: FolderMediaFile[] = [];
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
    for await (const entry of dir.values()) {
      if (found.length >= maxFiles) return;
      if (entry.name.startsWith('.')) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, path);
      } else {
        const kind = mediaKindOf(entry.name);
        if (!kind) continue;
        const file = await (entry as FileSystemFileHandle).getFile();
        found.push({
          id: folderMediaId(folder.id, path),
          name: entry.name,
          path,
          type: kind.type,
          mimeType: file.type || kind.mimeType,
          size: file.size,
          lastModified: file.lastModified,
          file,
        });
      }
    }
  };
  await walk(folder.handle, '');
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The file behind a folder media id, or null when the folder is gone, the
 * file was moved or read permission isn't granted (no prompt here).
 */
export async function getFolderFile(mediaId: string): Promise<File | null> {
  const parsed = parseFolderMediaId(mediaId);
  if (!parsed) return null;
  const db = await getProjectDB();
  const folder = await promisify(db.transaction(FOLDERS).objectStore(FOLDERS).get(parsed.folderId) as IDBRequest<LinkedFolder | undefined>);
  if (!folder) return null;
  try {
    if ((await folderPermission(folder)) !== 'granted') return null;
    const segments = parsed.path.split('/');
    let dir = folder.handle;
    for (const segment of segments.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(segment);
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1]);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}
