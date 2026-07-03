import type { MediaFrame, BackgroundSettings, GridSettings, CompositionSettings, ExportedMediaRecord } from '../types';

const STORAGE_KEY = 'video-mapper-project';
const VERSION = '4.0.0'; // Bumped for fixed composition resolution

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  type: 'color',
  color: '#1e293b', // slate-800
};

export const DEFAULT_GRID: GridSettings = {
  show: false,
  snap: false,
  size: 32,
  showInPresentation: false,
};

export const DEFAULT_COMPOSITION: CompositionSettings = {
  width: 1920,
  height: 1080,
};

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

const DEFAULT_PERSPECTIVE_CORNERS = {
  tl: { x: 0, y: 0 },
  tr: { x: 0, y: 0 },
  br: { x: 0, y: 0 },
  bl: { x: 0, y: 0 },
};

// Migrate old frame format to new format
const migrateFrame = (frame: MediaFrame): MediaFrame => {
  return {
    ...frame,
    // Add defaults for new properties if missing
    textureMode: frame.textureMode || 'clip',
    vertices: frame.vertices,
    mediaId: frame.mediaId,
    contentScale: frame.contentScale ?? 1,
    contentOffsetX: frame.contentOffsetX ?? 0,
    contentOffsetY: frame.contentOffsetY ?? 0,
    perspectiveMode: frame.perspectiveMode ?? false,
    perspectiveCorners: frame.perspectiveCorners ?? DEFAULT_PERSPECTIVE_CORNERS,
    visible: frame.visible ?? true,
    testPattern: frame.testPattern ?? false,
    softEdge: frame.softEdge ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
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
      version: VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save project to localStorage');
  }
};

export interface LoadedProject {
  frames: MediaFrame[];
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
  // Present when the project file embeds its media (export-with-media)
  media?: ExportedMediaRecord[];
}

export const loadProject = (): LoadedProject | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const projectData = JSON.parse(data);
    if (!projectData.frames) return null;

    // Migrate frames to ensure they have all new properties
    return {
      frames: projectData.frames.map(migrateFrame),
      background: projectData.background || DEFAULT_BACKGROUND,
      grid: { ...DEFAULT_GRID, ...projectData.grid },
      composition: { ...DEFAULT_COMPOSITION, ...projectData.composition },
    };
  } catch (error) {
    console.error('Failed to load project:', error);
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
      version: VERSION,
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
      try {
        const content = e.target?.result as string;
        const projectData = JSON.parse(content);
        
        if (!projectData.frames || !Array.isArray(projectData.frames)) {
          reject(new Error('Invalid project file format'));
          return;
        }
        
        // Migrate frames to ensure they have all new properties
        resolve({
          frames: projectData.frames.map(migrateFrame),
          background: projectData.background || DEFAULT_BACKGROUND,
          grid: { ...DEFAULT_GRID, ...projectData.grid },
          composition: { ...DEFAULT_COMPOSITION, ...projectData.composition },
          media: Array.isArray(projectData.media) ? projectData.media : undefined,
        });
      } catch {
        reject(new Error('Failed to parse project file'));
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

