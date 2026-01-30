import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { MediaFrame, DragState, ResizeState, RotateState, DrawState, ShapeType, Point, StoredMedia, BackgroundSettings } from '../types';
import { MediaFrameComponent } from './MediaFrame';
import { ControlPanel } from './ControlPanel';
import { MediaLibrary } from './MediaLibrary';
import { BackgroundSettingsPanel } from './BackgroundSettings';
import { saveProject, loadProject, exportProject, importProject, generateFrameId, DEFAULT_BACKGROUND } from '../lib/storage';
import { storeMedia, resolveMediaUrls, createMediaUrl } from '../lib/mediaStorage';

// State for polygon drawing (click to add vertices)
interface PolygonDrawState {
  isDrawing: boolean;
  vertices: Point[]; // Screen coordinates while drawing
  startX: number;
  startY: number;
}

export const Canvas: React.FC = () => {
  const [frames, setFrames] = useState<MediaFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    frameId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    frameId: null,
    handle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startFrameX: 0,
    startFrameY: 0,
  });
  const [rotateState, setRotateState] = useState<RotateState>({
    isRotating: false,
    frameId: null,
    startAngle: 0,
    centerX: 0,
    centerY: 0,
  });
  const [drawState, setDrawState] = useState<DrawState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [polygonDrawState, setPolygonDrawState] = useState<PolygonDrawState>({
    isDrawing: false,
    vertices: [],
    startX: 0,
    startY: 0,
  });
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawShape, setDrawShape] = useState<ShapeType | null>(null);
  const [pendingMediaUrl, setPendingMediaUrl] = useState<{url: string, type: 'video' | 'image', mediaId?: string} | null>(null);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaLibraryTargetFrameId, setMediaLibraryTargetFrameId] = useState<string | null>(null); // Which frame is requesting media change
  const [mediaLibraryTargetBackground, setMediaLibraryTargetBackground] = useState(false); // Is media library for background?
  const [, setMediaUrlCache] = useState<Map<string, string>>(new Map());
  const [background, setBackground] = useState<BackgroundSettings>(DEFAULT_BACKGROUND);
  const [isBackgroundSettingsOpen, setIsBackgroundSettingsOpen] = useState(false);
  const [showPresentationControls, setShowPresentationControls] = useState(false);
  const [playbackCommand, setPlaybackCommand] = useState<'play' | 'pause' | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  // Check if there are any video frames
  const hasVideos = frames.some(f => f.type === 'video');

  // Play all videos
  const handlePlayAll = useCallback(() => {
    setPlaybackCommand('play');
    // Reset command after a short delay to allow re-triggering
    setTimeout(() => setPlaybackCommand(null), 100);
  }, []);

  // Pause all videos
  const handlePauseAll = useCallback(() => {
    setPlaybackCommand('pause');
    setTimeout(() => setPlaybackCommand(null), 100);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ESC to exit presentation mode or draw mode
      if (e.key === 'Escape') {
        if (isPresentationMode) {
          setIsPresentationMode(false);
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
        } else if (polygonDrawState.isDrawing) {
          // Cancel polygon drawing
          setPolygonDrawState({
            isDrawing: false,
            vertices: [],
            startX: 0,
            startY: 0,
          });
          setIsDrawMode(false);
          setDrawShape(null);
          setPendingMediaUrl(null);
        } else if (isDrawMode) {
          setIsDrawMode(false);
          setDrawShape(null);
          setPendingMediaUrl(null);
        }
      }
      // P for presentation mode (only if not typing in input)
      if ((e.key === 'p' || e.key === 'P') && !isMediaLibraryOpen) {
        togglePresentationMode();
      }
      // F for fullscreen
      if ((e.key === 'f' || e.key === 'F') && !isMediaLibraryOpen) {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPresentationMode, isDrawMode, polygonDrawState.isDrawing, isMediaLibraryOpen]);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => !prev);
    setSelectedFrameId(null);
    setIsDrawMode(false);
    setDrawShape(null);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await canvasRef.current?.requestFullscreen();
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      await document.exitFullscreen();
    }
  }, []);

  const enterFullscreenPresentation = useCallback(async () => {
    setIsPresentationMode(true);
    setSelectedFrameId(null);
    setIsDrawMode(false);
    setDrawShape(null);
    try {
      await canvasRef.current?.requestFullscreen();
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  }, []);

  // Load project on mount and resolve media URLs
  useEffect(() => {
    const loadAndResolveMedia = async () => {
      const savedProject = loadProject();
      if (savedProject) {
        const { frames: savedFrames, background: savedBackground } = savedProject;
        
        // Get all unique media IDs that need to be resolved (frames + background)
        const mediaIds = [
          ...savedFrames.filter(f => f.mediaId).map(f => f.mediaId!),
          ...(savedBackground.mediaId ? [savedBackground.mediaId] : []),
        ];
        
        if (mediaIds.length > 0) {
          try {
            const urlMap = await resolveMediaUrls(mediaIds);
            setMediaUrlCache(urlMap);
            
            // Update frames with resolved URLs
            const resolvedFrames = savedFrames.map(frame => {
              if (frame.mediaId && urlMap.has(frame.mediaId)) {
                return { ...frame, url: urlMap.get(frame.mediaId)! };
              }
              return frame;
            });
            setFrames(resolvedFrames);
            
            // Update background with resolved URL
            if (savedBackground.mediaId && urlMap.has(savedBackground.mediaId)) {
              setBackground({ ...savedBackground, url: urlMap.get(savedBackground.mediaId) });
            } else {
              setBackground(savedBackground);
            }
          } catch (error) {
            console.error('Failed to resolve media URLs:', error);
            setFrames(savedFrames);
            setBackground(savedBackground);
          }
        } else {
          setFrames(savedFrames);
          setBackground(savedBackground);
        }
      }
    };
    
    loadAndResolveMedia();
  }, []);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (frames.length > 0 || background.type !== 'color') {
        saveProject(frames, background);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [frames, background]);

  const addFrame = useCallback((frame: Omit<MediaFrame, 'id'>) => {
    const newFrame: MediaFrame = {
      ...frame,
      id: generateFrameId(),
      // Ensure all effect properties have defaults
      blur: frame.blur ?? 0,
      brightness: frame.brightness ?? 100,
      contrast: frame.contrast ?? 100,
      grayscale: frame.grayscale ?? 0,
      saturate: frame.saturate ?? 100,
      hueRotate: frame.hueRotate ?? 0,
      invert: frame.invert ?? 0,
      sepia: frame.sepia ?? 0,
      blendMode: frame.blendMode ?? 'normal',
      flipHorizontal: frame.flipHorizontal ?? false,
      flipVertical: frame.flipVertical ?? false,
      lockAspectRatio: frame.lockAspectRatio ?? true,
      textureMode: frame.textureMode ?? 'clip',
      vertices: frame.vertices,
      contentScale: frame.contentScale ?? 1,
      contentOffsetX: frame.contentOffsetX ?? 0,
      contentOffsetY: frame.contentOffsetY ?? 0,
    };
    setFrames(prev => [...prev, newFrame]);
    setSelectedFrameId(newFrame.id);
  }, []);

  const updateFrame = useCallback((id: string, updates: Partial<MediaFrame>) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const deleteFrame = useCallback((id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
    if (selectedFrameId === id) {
      setSelectedFrameId(null);
    }
  }, [selectedFrameId]);

  // Handle canvas mouse down
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current) {
      setSelectedFrameId(null);
      
      if (isDrawMode && drawShape) {
        if (drawShape === 'polygon') {
          // Polygon drawing: add vertex on click
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (!polygonDrawState.isDrawing) {
              // Start new polygon
              setPolygonDrawState({
                isDrawing: true,
                vertices: [{ x, y }],
                startX: x,
                startY: y,
              });
            } else {
              // Check if clicking near first vertex to close polygon
              const firstVertex = polygonDrawState.vertices[0];
              const distance = Math.sqrt(
                Math.pow(x - firstVertex.x, 2) + Math.pow(y - firstVertex.y, 2)
              );
              
              if (distance < 20 && polygonDrawState.vertices.length >= 3) {
                // Close polygon
                finishPolygon();
              } else {
                // Add new vertex
                setPolygonDrawState(prev => ({
                  ...prev,
                  vertices: [...prev.vertices, { x, y }],
                }));
              }
            }
          }
        } else {
          // Rectangle or circle: drag to draw
          setDrawState({
            isDrawing: true,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
        }
      }
    }
  }, [isDrawMode, drawShape, polygonDrawState]);

  // Handle double-click to close polygon
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current && drawShape === 'polygon' && polygonDrawState.isDrawing) {
      if (polygonDrawState.vertices.length >= 3) {
        finishPolygon();
      }
    }
  }, [drawShape, polygonDrawState]);

  // Finish polygon and create frame
  const finishPolygon = useCallback(() => {
    if (polygonDrawState.vertices.length < 3) {
      setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
      return;
    }

    // Calculate bounding box
    const xs = polygonDrawState.vertices.map(v => v.x);
    const ys = polygonDrawState.vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    // Skip if too small
    if (width < 20 || height < 20) {
      setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
      return;
    }

    // Convert vertices to normalized coordinates (0-1) relative to bounding box
    const normalizedVertices: Point[] = polygonDrawState.vertices.map(v => ({
      x: (v.x - minX) / width,
      y: (v.y - minY) / height,
    }));

    const newFrame: Omit<MediaFrame, 'id'> = {
      type: pendingMediaUrl?.type || 'image',
      url: pendingMediaUrl?.url || '',
      mediaId: pendingMediaUrl?.mediaId,
      x: minX,
      y: minY,
      width,
      height,
      rotation: 0,
      shape: 'polygon',
      vertices: normalizedVertices,
      textureMode: 'clip',
      loop: true,
      opacity: 1,
      zIndex: frames.length,
      playbackRate: 1,
      muted: false,
      blur: 0,
      brightness: 100,
      contrast: 100,
      grayscale: 0,
      saturate: 100,
      hueRotate: 0,
      invert: 0,
      sepia: 0,
      blendMode: 'normal',
      flipHorizontal: false,
      flipVertical: false,
      lockAspectRatio: false, // Polygons don't have aspect ratio lock
    };

    if (pendingMediaUrl?.url) {
      try {
        const urlObj = new URL(pendingMediaUrl.url);
        const pathname = urlObj.pathname;
        const lastSegment = pathname.split('/').pop();
        if (lastSegment) {
          newFrame.filename = decodeURIComponent(lastSegment);
        }
      } catch {
        // If URL parsing fails, leave filename undefined
      }
    }

    addFrame(newFrame);
    setPendingMediaUrl(null);
    setPolygonDrawState({ isDrawing: false, vertices: [], startX: 0, startY: 0 });
    setIsDrawMode(false);
    setDrawShape(null);
  }, [polygonDrawState, pendingMediaUrl, frames.length, addFrame]);

  // Handle frame drag start
  const handleDragStart = useCallback((frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frame = frames.find(f => f.id === frameId);
    if (!frame) return;

    setDragState({
      isDragging: true,
      frameId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: frame.x,
      offsetY: frame.y,
    });
  }, [frames]);

  // Handle resize start
  const handleResizeStart = useCallback((frameId: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frame = frames.find(f => f.id === frameId);
    if (!frame) return;

    setResizeState({
      isResizing: true,
      frameId,
      handle: handle as ResizeState['handle'],
      startX: e.clientX,
      startY: e.clientY,
      startWidth: frame.width,
      startHeight: frame.height,
      startFrameX: frame.x,
      startFrameY: frame.y,
    });
  }, [frames]);

  // Handle rotate start
  const handleRotateStart = useCallback((frameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const frame = frames.find(f => f.id === frameId);
    if (!frame) return;

    const centerX = frame.x + frame.width / 2;
    const centerY = frame.y + frame.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    setRotateState({
      isRotating: true,
      frameId,
      startAngle: angle - (frame.rotation * Math.PI / 180),
      centerX,
      centerY,
    });
  }, [frames]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Handle dragging
    if (dragState.isDragging && dragState.frameId) {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      updateFrame(dragState.frameId, {
        x: dragState.offsetX + deltaX,
        y: dragState.offsetY + deltaY,
      });
    }

    // Handle resizing
    if (resizeState.isResizing && resizeState.frameId) {
      const frame = frames.find(f => f.id === resizeState.frameId);
      if (!frame) return;
      
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const handle = resizeState.handle;
      const aspectRatio = resizeState.startWidth / resizeState.startHeight;

      let newWidth = resizeState.startWidth;
      let newHeight = resizeState.startHeight;
      let newX = resizeState.startFrameX;
      let newY = resizeState.startFrameY;

      if (frame.lockAspectRatio && (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se')) {
        // Corner handles with aspect ratio lock
        const isEast = handle.includes('e');
        const isSouth = handle.includes('s');
        
        if (isEast) {
          newWidth = Math.max(50, resizeState.startWidth + deltaX);
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = Math.max(50, resizeState.startWidth - deltaX);
          newHeight = newWidth / aspectRatio;
          newX = resizeState.startFrameX + deltaX;
        }
        
        if (!isSouth) {
          newY = resizeState.startFrameY + resizeState.startHeight - newHeight;
        }
      } else {
        // Free resize or edge handles
        if (handle?.includes('e')) {
          newWidth = Math.max(50, resizeState.startWidth + deltaX);
        }
        if (handle?.includes('w')) {
          newWidth = Math.max(50, resizeState.startWidth - deltaX);
          newX = resizeState.startFrameX + deltaX;
        }
        if (handle?.includes('s')) {
          newHeight = Math.max(50, resizeState.startHeight + deltaY);
        }
        if (handle?.includes('n')) {
          newHeight = Math.max(50, resizeState.startHeight - deltaY);
          newY = resizeState.startFrameY + deltaY;
        }
      }

      updateFrame(resizeState.frameId, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY,
      });
    }

    // Handle rotating
    if (rotateState.isRotating && rotateState.frameId) {
      const angle = Math.atan2(
        e.clientY - rotateState.centerY,
        e.clientX - rotateState.centerX
      );
      const rotation = ((angle - rotateState.startAngle) * 180 / Math.PI) % 360;
      updateFrame(rotateState.frameId, { rotation });
    }

    // Handle drawing
    if (drawState.isDrawing) {
      setDrawState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      }));
    }
  }, [dragState, resizeState, rotateState, drawState, updateFrame]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // Finish drawing (only for rectangle/circle, not polygon)
    if (drawState.isDrawing && drawShape && drawShape !== 'polygon') {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const width = Math.abs(drawState.currentX - drawState.startX);
      const height = Math.abs(drawState.currentY - drawState.startY);

      if (width > 20 && height > 20) {
        // Always create a frame, even without media URL
        const newFrame: Omit<MediaFrame, 'id'> = {
          type: pendingMediaUrl?.type || 'image',
          url: pendingMediaUrl?.url || '',
          mediaId: pendingMediaUrl?.mediaId,
          x,
          y,
          width,
          height,
          rotation: 0,
          shape: drawShape,
          textureMode: 'clip',
          loop: true,
          opacity: 1,
          zIndex: frames.length,
          playbackRate: 1,
          muted: false,
          blur: 0,
          brightness: 100,
          contrast: 100,
          grayscale: 0,
          saturate: 100,
          hueRotate: 0,
          invert: 0,
          sepia: 0,
          blendMode: 'normal',
          flipHorizontal: false,
          flipVertical: false,
          lockAspectRatio: true,
        };

        // Add filename if URL is provided
        if (pendingMediaUrl?.url) {
          try {
            const urlObj = new URL(pendingMediaUrl.url);
            const pathname = urlObj.pathname;
            const lastSegment = pathname.split('/').pop();
            if (lastSegment) {
              newFrame.filename = decodeURIComponent(lastSegment);
            }
          } catch {
            // If URL parsing fails, leave filename undefined
          }
        }

        addFrame(newFrame);
        setPendingMediaUrl(null);
      }
      
      setDrawState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
      setIsDrawMode(false);
      setDrawShape(null);
    }

    setDragState(prev => ({ ...prev, isDragging: false, frameId: null }));
    setResizeState(prev => ({ ...prev, isResizing: false, frameId: null }));
    setRotateState(prev => ({ ...prev, isRotating: false, frameId: null }));
  }, [drawState, drawShape, frames.length, addFrame, pendingMediaUrl]);

  // Add mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        
        try {
          // Store in IndexedDB
          const storedMedia = await storeMedia(file, file.name, type);
          const url = URL.createObjectURL(storedMedia.blob);
          
          // Update cache
          setMediaUrlCache(prev => new Map(prev).set(storedMedia.id, url));
          
          addFrame({
            type,
            url,
            mediaId: storedMedia.id,
            filename: file.name,
            x: e.clientX - 150,
            y: e.clientY - 100,
            width: 300,
            height: 200,
            rotation: 0,
            shape: 'rectangle',
            textureMode: 'clip',
            loop: true,
            opacity: 1,
            zIndex: frames.length,
            playbackRate: 1,
            muted: false,
            blur: 0,
            brightness: 100,
            contrast: 100,
            grayscale: 0,
            saturate: 100,
            hueRotate: 0,
            invert: 0,
            sepia: 0,
            blendMode: 'normal',
            flipHorizontal: false,
            flipVertical: false,
            lockAspectRatio: true,
          });
        } catch (error) {
          console.error('Failed to store media:', error);
          alert((error as Error).message);
        }
      }
    }
  }, [frames.length, addFrame]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Control panel handlers
  const handleAddUrl = useCallback((url: string, type: 'video' | 'image') => {
    setPendingMediaUrl({ url, type });
    setIsDrawMode(true);
    setDrawShape('rectangle');
  }, []);

  // Handle media selection from library
  const handleSelectMedia = useCallback(async (media: StoredMedia) => {
    const url = URL.createObjectURL(media.blob);
    setMediaUrlCache(prev => new Map(prev).set(media.id, url));
    
    // Check if selecting for background
    if (mediaLibraryTargetBackground) {
      setBackground(prev => ({
        ...prev,
        url,
        mediaId: media.id,
      }));
      setMediaLibraryTargetBackground(false);
    }
    // Check if we're changing media for an existing frame
    else if (mediaLibraryTargetFrameId) {
      // Update the existing frame with new media
      updateFrame(mediaLibraryTargetFrameId, {
        url,
        type: media.type,
        mediaId: media.id,
        filename: media.name,
      });
      setMediaLibraryTargetFrameId(null);
    } else {
      // Set pending media for new frame creation
      setPendingMediaUrl({ url, type: media.type, mediaId: media.id });
      setIsDrawMode(true);
      setDrawShape('rectangle');
    }
  }, [mediaLibraryTargetFrameId, mediaLibraryTargetBackground, updateFrame]);

  // Handle opening media library for a specific frame (to change its media)
  const handleOpenMediaLibraryForFrame = useCallback((frameId: string) => {
    setMediaLibraryTargetFrameId(frameId);
    setMediaLibraryTargetBackground(false);
    setIsMediaLibraryOpen(true);
  }, []);

  // Handle opening media library for new media selection
  const handleOpenMediaLibrary = useCallback(() => {
    setMediaLibraryTargetFrameId(null);
    setMediaLibraryTargetBackground(false);
    setIsMediaLibraryOpen(true);
  }, []);

  // Handle opening media library for background
  const handleOpenMediaLibraryForBackground = useCallback(() => {
    setMediaLibraryTargetFrameId(null);
    setMediaLibraryTargetBackground(true);
    setIsMediaLibraryOpen(true);
  }, []);

  const handleDrawMode = useCallback((shape: ShapeType) => {
    if (isDrawMode && drawShape === shape) {
      setIsDrawMode(false);
      setDrawShape(null);
    } else {
      setIsDrawMode(true);
      setDrawShape(shape);
    }
  }, [isDrawMode, drawShape]);

  const handleSave = useCallback(() => {
    saveProject(frames, background);
    alert('Project saved!');
  }, [frames, background]);

  const handleExport = useCallback(() => {
    exportProject(frames, background);
  }, [frames, background]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const imported = await importProject(file);
      setFrames(imported.frames);
      setBackground(imported.background);
      alert('Project imported successfully!');
    } catch (error) {
      alert('Failed to import project: ' + (error as Error).message);
    }
  }, []);

  // Draw preview rectangle/circle
  const drawPreview = drawState.isDrawing && drawShape && drawShape !== 'polygon' ? {
    x: Math.min(drawState.startX, drawState.currentX),
    y: Math.min(drawState.startY, drawState.currentY),
    width: Math.abs(drawState.currentX - drawState.startX),
    height: Math.abs(drawState.currentY - drawState.startY),
  } : null;

  // Polygon preview points string for SVG
  const polygonPreviewPoints = polygonDrawState.isDrawing && polygonDrawState.vertices.length > 0
    ? polygonDrawState.vertices.map(v => `${v.x},${v.y}`).join(' ')
    : null;

  return (
    <>
      {!isPresentationMode && (
        <ControlPanel
          onAddUrl={handleAddUrl}
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          onDrawMode={handleDrawMode}
          isDrawMode={isDrawMode}
          drawShape={drawShape}
          onPresentationMode={enterFullscreenPresentation}
          onOpenMediaLibrary={handleOpenMediaLibrary}
          onOpenBackgroundSettings={() => setIsBackgroundSettingsOpen(true)}
          onPlayAll={handlePlayAll}
          onPauseAll={handlePauseAll}
          hasVideos={hasVideos}
        />
      )}

      {/* Media Library Modal */}
      <MediaLibrary
        isOpen={isMediaLibraryOpen}
        onClose={() => {
          setIsMediaLibraryOpen(false);
          setMediaLibraryTargetFrameId(null);
          setMediaLibraryTargetBackground(false);
        }}
        onSelectMedia={handleSelectMedia}
      />

      {/* Background Settings Panel */}
      <BackgroundSettingsPanel
        background={background}
        onUpdate={setBackground}
        onOpenMediaLibrary={handleOpenMediaLibraryForBackground}
        isOpen={isBackgroundSettingsOpen}
        onClose={() => setIsBackgroundSettingsOpen(false)}
      />
      
      <div
        ref={canvasRef}
        className="w-full h-full relative overflow-hidden cursor-crosshair"
        style={{ backgroundColor: background.type === 'color' ? background.color : undefined }}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={(e) => {
          // Show presentation controls when mouse is in top-right corner
          if (isPresentationMode) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const isInCorner = e.clientX > rect.right - 150 && e.clientY < rect.top + 100;
              setShowPresentationControls(isInCorner);
            }
          }
        }}
        onMouseLeave={() => isPresentationMode && setShowPresentationControls(false)}
      >
        {/* Background Image/Video */}
        {background.type === 'image' && background.url && (
          <img
            src={background.url}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {background.type === 'video' && background.url && (
          <video
            ref={backgroundVideoRef}
            src={background.url}
            loop={background.loop ?? true}
            muted={background.muted ?? true}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Presentation Mode Controls - only show on corner hover */}
        {isPresentationMode && showPresentationControls && (
          <div className="absolute top-4 right-4 z-50 flex gap-2 animate-fade-in">
            <button
              onClick={togglePresentationMode}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2"
              title="Exit Presentation Mode (ESC or P)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Mode
            </button>
            {!document.fullscreenElement && (
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Fullscreen (F)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>
        )}
        {/* Frames */}
        {frames.map(frame => (
          <MediaFrameComponent
            key={frame.id}
            frame={frame}
            isSelected={selectedFrameId === frame.id && !isPresentationMode}
            onSelect={() => !isPresentationMode && setSelectedFrameId(frame.id)}
            onUpdate={(updates) => updateFrame(frame.id, updates)}
            onDelete={() => deleteFrame(frame.id)}
            onDragStart={(e) => !isPresentationMode && handleDragStart(frame.id, e)}
            onResizeStart={(e, handle) => !isPresentationMode && handleResizeStart(frame.id, handle, e)}
            onRotateStart={(e) => !isPresentationMode && handleRotateStart(frame.id, e)}
            isPresentationMode={isPresentationMode}
            onOpenMediaLibrary={() => handleOpenMediaLibraryForFrame(frame.id)}
            playbackCommand={playbackCommand}
          />
        ))}

        {/* Draw Preview for Rectangle/Circle */}
        {drawPreview && (
          <div
            className="absolute border-4 border-dashed border-yellow-400 bg-yellow-400/20 pointer-events-none"
            style={{
              left: drawPreview.x,
              top: drawPreview.y,
              width: drawPreview.width,
              height: drawPreview.height,
              clipPath: drawShape === 'circle' ? 'ellipse(50% 50% at 50% 50%)' : 'none',
            }}
          />
        )}

        {/* Polygon Preview */}
        {polygonDrawState.isDrawing && polygonDrawState.vertices.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
            {/* Draw lines between vertices */}
            <polyline
              points={polygonPreviewPoints || ''}
              fill="rgba(250, 204, 21, 0.2)"
              stroke="#facc15"
              strokeWidth="3"
              strokeDasharray="8 4"
            />
            {/* Draw vertices as circles */}
            {polygonDrawState.vertices.map((vertex, index) => (
              <circle
                key={index}
                cx={vertex.x}
                cy={vertex.y}
                r={index === 0 ? 10 : 6}
                fill={index === 0 ? '#22c55e' : '#facc15'}
                stroke={index === 0 ? '#16a34a' : '#ca8a04'}
                strokeWidth="2"
              />
            ))}
            {/* Instruction text */}
            <text
              x="50%"
              y="30"
              textAnchor="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
              className="drop-shadow-lg"
            >
              {polygonDrawState.vertices.length < 3
                ? `Click to add vertices (${polygonDrawState.vertices.length}/3 minimum)`
                : 'Double-click or click green point to close polygon'
              }
            </text>
          </svg>
        )}

        {/* Instructions overlay when empty */}
        {frames.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/50">
              <p className="text-2xl font-bold mb-2">Video Mapper</p>
              <p className="text-lg">Draw a frame or drop media files to start</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

