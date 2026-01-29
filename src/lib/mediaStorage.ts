import type { StoredMedia, MediaType, MediaLibraryStats } from '../types';

const DB_NAME = 'video-mapper-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';

// Storage limits
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
export const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total

let dbInstance: IDBDatabase | null = null;

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
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Check total storage
  const stats = await getStorageStats();
  if (stats.totalSize + file.size > MAX_TOTAL_SIZE) {
    throw new Error(`Storage limit exceeded. Maximum total storage is ${MAX_TOTAL_SIZE / 1024 / 1024}MB. Please delete some media first.`);
  }

  const db = await getDB();
  
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

    request.onsuccess = () => resolve();
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

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear media'));
  });
};

/**
 * Get storage statistics
 */
export const getStorageStats = async (): Promise<MediaLibraryStats> => {
  const allMedia = await getAllMedia();
  
  return {
    totalSize: allMedia.reduce((sum, m) => sum + m.size, 0),
    count: allMedia.length,
    maxSize: MAX_TOTAL_SIZE,
  };
};

/**
 * Create a blob URL for a stored media
 */
export const createMediaUrl = async (mediaId: string): Promise<string | null> => {
  const media = await getMedia(mediaId);
  if (!media) return null;
  return URL.createObjectURL(media.blob);
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
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
