export type MediaType = 'video' | 'image';
export type ShapeType = 'rectangle' | 'circle';

export interface MediaFrame {
  id: string;
  type: MediaType;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: ShapeType;
  loop: boolean;
  opacity: number;
  zIndex: number;
  playbackRate: number;
  muted: boolean;
}

export interface ProjectData {
  frames: MediaFrame[];
  version: string;
}

export interface DragState {
  isDragging: boolean;
  frameId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export interface ResizeState {
  isResizing: boolean;
  frameId: string | null;
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startFrameX: number;
  startFrameY: number;
}

export interface RotateState {
  isRotating: boolean;
  frameId: string | null;
  startAngle: number;
  centerX: number;
  centerY: number;
}

export interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

