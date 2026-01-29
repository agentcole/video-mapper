import type { MediaFrame } from '../types';

const STORAGE_KEY = 'video-mapper-project';
const VERSION = '2.0.0'; // Bumped for polygon & media storage support

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

// Migrate old frame format to new format
const migrateFrame = (frame: MediaFrame): MediaFrame => {
  return {
    ...frame,
    // Add defaults for new properties if missing
    textureMode: frame.textureMode || 'clip',
    vertices: frame.vertices,
    mediaId: frame.mediaId,
  };
};

export const saveProject = (frames: MediaFrame[]): void => {
  try {
    const preparedFrames = prepareFramesForStorage(frames);
    const projectData = {
      frames: preparedFrames,
      version: VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save project to localStorage');
  }
};

export const loadProject = (): MediaFrame[] | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const projectData = JSON.parse(data);
    if (!projectData.frames) return null;
    
    // Migrate frames to ensure they have all new properties
    return projectData.frames.map(migrateFrame);
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
};

export const exportProject = (frames: MediaFrame[]): void => {
  try {
    const projectData = {
      frames,
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

export const importProject = (file: File): Promise<MediaFrame[]> => {
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
        const migratedFrames = projectData.frames.map(migrateFrame);
        resolve(migratedFrames);
      } catch (error) {
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

