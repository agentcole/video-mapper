import type { MediaFrame, BackgroundSettings, GridSettings, CompositionSettings, ExportedMediaRecord } from '../types';
import { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION } from './defaults';
import { parseProjectData, PROJECT_VERSION, type ParsedProject } from './projectSchema';

export { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION };

const STORAGE_KEY = 'video-mapper-project';
// Unreadable autosaves are moved here instead of being overwritten
const CORRUPT_BACKUP_PREFIX = 'video-mapper-project-unreadable-';

// Prepare frames for storage - remove temporary blob URLs
const prepareFramesForStorage = (frames: MediaFrame[]): MediaFrame[] => {
  return frames.map(frame => {
    const storedFrame = { ...frame };
    
    // If frame has a mediaId, clear the url (it's a temporary blob URL)
    // The URL will be regenerated from IndexedDB on load
    if (storedFrame.mediaId) {
      storedFrame.url = '';
    }
    
    return storedFrame;
  });
};

// Prepare background for storage
const prepareBackgroundForStorage = (bg: BackgroundSettings): BackgroundSettings => {
  const stored = { ...bg };
  // If background has a mediaId, clear the url
  if (stored.mediaId) {
    stored.url = '';
  }
  return stored;
};

export const saveProject = (
  frames: MediaFrame[],
  background?: BackgroundSettings,
  grid?: GridSettings,
  composition?: CompositionSettings
): void => {
  try {
    const preparedFrames = prepareFramesForStorage(frames);
    const projectData = {
      frames: preparedFrames,
      background: background ? prepareBackgroundForStorage(background) : DEFAULT_BACKGROUND,
      grid: grid || DEFAULT_GRID,
      composition: composition || DEFAULT_COMPOSITION,
      version: PROJECT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
  } catch (error) {
    console.error('Failed to save project:', error);
    const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError';
    throw new Error(isQuota
      ? 'browser storage is full — export the project to keep your changes'
      : 'could not write to browser storage');
  }
};

// A validated, migrated project (see projectSchema.ts)
export type LoadedProject = ParsedProject;

export const loadProject = (): LoadedProject | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    // Autosaves never embed media
    return { ...parseProjectData(JSON.parse(data)), media: undefined };
  } catch (error) {
    // Keep the unreadable data instead of letting the next autosave
    // overwrite it — it may still be recoverable by hand
    console.error('Failed to load project; keeping a backup of the stored data:', error);
    try {
      localStorage.setItem(`${CORRUPT_BACKUP_PREFIX}${Date.now()}`, data);
    } catch {
      // storage full — nothing more we can do here
    }
    return null;
  }
};

export const exportProject = (
  frames: MediaFrame[],
  background?: BackgroundSettings,
  grid?: GridSettings,
  composition?: CompositionSettings,
  embeddedMedia?: ExportedMediaRecord[]
): void => {
  try {
    // Strip session-specific blob URLs — they are dead outside this session.
    // Frames with a mediaId get their URL re-resolved from IndexedDB on import.
    const projectData = {
      frames: prepareFramesForStorage(frames),
      background: background ? prepareBackgroundForStorage(background) : DEFAULT_BACKGROUND,
      grid: grid || DEFAULT_GRID,
      composition: composition || DEFAULT_COMPOSITION,
      ...(embeddedMedia && embeddedMedia.length > 0 ? { media: embeddedMedia } : {}),
      version: PROJECT_VERSION,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-mapper-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export project:', error);
    throw new Error('Failed to export project');
  }
};

export const importProject = (file: File): Promise<LoadedProject> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      let projectData: unknown;
      try {
        projectData = JSON.parse(e.target?.result as string);
      } catch {
        reject(new Error('Failed to parse project file'));
        return;
      }
      try {
        resolve(parseProjectData(projectData));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

export const generateFrameId = (): string => {
  return `frame-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

