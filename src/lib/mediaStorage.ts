import type { StoredMedia, MediaType, MediaLibraryStats, ExportedMediaRecord } from '../types';
import { getFolderFile, isFolderMediaId, mediaKindOf } from './mediaFolders';

const DB_NAME = 'video-mapper-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';

// Storage limits — the real ceiling is the browser's quota for this origin
// (≈60 % of free disk in Chromium/Safari). Larger show files are better
// played from a linked folder (no copy at all).
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per file
const FALLBACK_QUOTA = 2 * 1024 * 1024 * 1024;

const storageEstimate = async (): Promise<{ usage: number; quota: number }> => {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? FALLBACK_QUOTA };
  } catch {
    return { usage: 0, quota: FALLBACK_QUOTA };
  }
};

let dbInstance: IDBDatabase | null = null;

// One object URL per stored media for the whole session. Reusing it (instead
// of minting a URL per frame, drop or project load) bounds memory to the
// library itself; URLs are revoked when their media is deleted.
const objectUrlCache = new Map<string, string>();

/** Session-wide object URL for a stored media (created once, then reused). */
export const getMediaObjectUrl = (media: StoredMedia): string => {
  let url = objectUrlCache.get(media.id);
  if (!url) {
    url = URL.createObjectURL(media.blob);
    objectUrlCache.set(media.id, url);
  }
  return url;
};

const revokeMediaObjectUrl = (id: string): void => {
  const url = objectUrlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(id);
  }
};

// Ask the browser not to evict the media library under storage pressure.
// Requested on the first store (a user action) rather than on page load.
let persistRequested = false;
const requestPersistentStorage = (): void => {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
};

/**
 * Initialize and get the IndexedDB database
 */
export const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
    };
  });
};

/**
 * Generate a unique media ID
 */
export const generateMediaId = (): string => {
  return `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate a thumbnail from a video or image file
 */
export const generateThumbnail = async (
  blob: Blob,
  type: MediaType,
  maxSize: number = 150
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    if (type === 'image') {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for thumbnail'));
      };
      img.src = url;
    } else {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video for thumbnail'));
      };
      
      video.src = url;
    }
  });
};

/**
 * Store a media file in IndexedDB
 */
export const storeMedia = async (
  file: File | Blob,
  name: string,
  type: MediaType
): Promise<StoredMedia> => {
  // Check file size limit
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)} — link its folder instead.`);
  }

  // Check the browser quota
  const { usage, quota } = await storageEstimate();
  if (usage + file.size > quota) {
    throw new Error(`Browser storage is full (${formatBytes(usage)} of ${formatBytes(quota)}). Delete media or link a folder instead.`);
  }

  const db = await getDB();
  requestPersistentStorage();

  // Generate thumbnail
  let thumbnail: string | undefined;
  try {
    thumbnail = await generateThumbnail(file, type);
  } catch (error) {
    console.warn('Failed to generate thumbnail:', error);
  }

  const media: StoredMedia = {
    id: generateMediaId(),
    name,
    type,
    mimeType: file.type || (type === 'video' ? 'video/mp4' : 'image/png'),
    size: file.size,
    blob: file,
    thumbnail,
    dateAdded: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(media);

    request.onsuccess = () => resolve(media);
    request.onerror = () => reject(new Error('Failed to store media'));
  });
};

/**
 * Get a media file from IndexedDB by ID
 */
export const getMedia = async (id: string): Promise<StoredMedia | null> => {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get media'));
  });
};

/**
 * Get all stored media
 */
export const getAllMedia = async (): Promise<StoredMedia[]> => {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Failed to get all media'));
  });
};

/**
 * Delete a media file from IndexedDB
 */
export const deleteMedia = async (id: string): Promise<void> => {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      revokeMediaObjectUrl(id);
      resolve();
    };
    request.onerror = () => reject(new Error('Failed to delete media'));
  });
};

/**
 * Clear all stored media
 */
export const clearAllMedia = async (): Promise<void> => {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      [...objectUrlCache.keys()].forEach(revokeMediaObjectUrl);
      resolve();
    };
    request.onerror = () => reject(new Error('Failed to clear media'));
  });
};

/**
 * Get storage statistics
 */
export const getStorageStats = async (): Promise<MediaLibraryStats> => {
  const allMedia = await getAllMedia();
  const { quota } = await storageEstimate();

  return {
    totalSize: allMedia.reduce((sum, m) => sum + m.size, 0),
    count: allMedia.length,
    maxSize: quota,
  };
};

/**
 * Object URL for a stored media (cached for the session)
 */
export const createMediaUrl = async (mediaId: string): Promise<string | null> => {
  const cached = objectUrlCache.get(mediaId);
  if (cached) return cached;
  const file = await getMediaFile(mediaId);
  if (!file) return null;
  const url = URL.createObjectURL(file.blob);
  objectUrlCache.set(mediaId, url);
  return url;
};

export interface MediaFile {
  blob: Blob;
  name: string;
  type: MediaType;
  mimeType: string;
}

/** The bytes behind a media id — library (IndexedDB) or linked folder. */
export const getMediaFile = async (mediaId: string): Promise<MediaFile | null> => {
  if (isFolderMediaId(mediaId)) {
    const file = await getFolderFile(mediaId);
    const kind = file ? mediaKindOf(file.name) : null;
    if (file && kind) return { blob: file, name: file.name, type: kind.type, mimeType: file.type || kind.mimeType };
    // Not linked on this machine — an imported package may have stored a copy
  }
  const media = await getMedia(mediaId);
  return media ? { blob: media.blob, name: media.name, type: media.type, mimeType: media.mimeType } : null;
};

/**
 * Resolve all media IDs in frames to blob URLs
 * Returns a map of mediaId -> blobUrl
 */
export const resolveMediaUrls = async (mediaIds: string[]): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>();
  
  for (const id of mediaIds) {
    const url = await createMediaUrl(id);
    if (url) {
      urlMap.set(id, url);
    }
  }
  
  return urlMap;
};

/**
 * Store media from an imported project under its original id, so
 * frame.mediaId references keep working. Existing ids are kept as they are.
 */
export const importMediaBlob = async (entry: { id: string; name: string; type: MediaType; mimeType: string; blob: Blob }): Promise<void> => {
  if (await getMedia(entry.id)) return;
  const db = await getDB();
  requestPersistentStorage();

  let thumbnail: string | undefined;
  try {
    thumbnail = await generateThumbnail(entry.blob, entry.type);
  } catch (error) {
    console.warn('Failed to generate thumbnail for imported media:', error);
  }

  const media: StoredMedia = {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    mimeType: entry.mimeType,
    size: entry.blob.size,
    blob: entry.blob,
    thumbnail,
    dateAdded: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const request = transaction.objectStore(STORE_NAME).put(media);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to import media'));
  });
};

/** Legacy project files embedded media as base64 data URLs. */
export const importMediaRecords = async (records: ExportedMediaRecord[]): Promise<void> => {
  for (const record of records) {
    const blob = await (await fetch(record.dataUrl)).blob();
    await importMediaBlob({ id: record.id, name: record.name, type: record.type, mimeType: record.mimeType, blob });
  }
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
