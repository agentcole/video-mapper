import type { MediaFrame } from '../types';

const STORAGE_KEY = 'video-mapper-project';
const VERSION = '1.0.0';

export const saveProject = (frames: MediaFrame[]): void => {
  try {
    const projectData = {
      frames,
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
    return projectData.frames || null;
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
        
        resolve(projectData.frames);
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

