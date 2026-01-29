// Types for the Video Mapper application

export type MediaType = 'video' | 'image'
export type ShapeType = 'rectangle' | 'circle'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface MediaFrame {
  id: string
  type: MediaType
  url: string
  filename?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  shape: ShapeType
  loop: boolean
  opacity: number
  zIndex: number
  playbackRate: number
  muted: boolean
  // Effects
  blur: number
  brightness: number
  contrast: number
  grayscale: number
  saturate: number
  hueRotate: number
  invert: number
  sepia: number
  blendMode: BlendMode
  flipHorizontal: boolean
  flipVertical: boolean
  // Scaling
  lockAspectRatio: boolean
}

export interface ProjectData {
  frames: MediaFrame[]
  version: string
}

export interface DragState {
  isDragging: boolean
  frameId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

export interface ResizeState {
  isResizing: boolean
  frameId: string | null
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startFrameX: number
  startFrameY: number
}

export interface RotateState {
  isRotating: boolean
  frameId: string | null
  startAngle: number
  centerX: number
  centerY: number
}

export interface DrawState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

