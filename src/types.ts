// Types for the Video Mapper application

export type MediaType = 'video' | 'image'
export type ShapeType = 'rectangle' | 'circle' | 'polygon'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'
export type TextureMode = 'clip' | 'warp'
export type BackgroundType = 'color' | 'image' | 'video'

// Canvas background settings
export interface BackgroundSettings {
  type: BackgroundType
  color: string // hex color
  url?: string // for image/video
  mediaId?: string // reference to stored media
  loop?: boolean // for video
  muted?: boolean // for video
}

// Point for polygon vertices (relative to frame, 0-1 normalized)
export interface Point {
  x: number
  y: number
}

// Stored media in IndexedDB
export interface StoredMedia {
  id: string
  name: string
  type: MediaType
  mimeType: string
  size: number
  blob: Blob
  thumbnail?: string // base64 data URL for preview
  dateAdded: number
}

// Media library stats
export interface MediaLibraryStats {
  totalSize: number
  count: number
  maxSize: number // max allowed total size
}

export interface MediaFrame {
  id: string
  type: MediaType
  url: string
  filename?: string
  mediaId?: string // Reference to stored media in IndexedDB
  x: number
  y: number
  width: number
  height: number
  rotation: number
  shape: ShapeType
  // Polygon-specific properties
  vertices?: Point[] // Normalized vertices (0-1) for polygon shape
  textureMode: TextureMode // How to render media in polygon: clip or warp
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
  // Content zoom/scale (1 = 100%, 2 = 200%, etc.)
  contentScale: number
  // Content position offset (for panning zoomed content)
  contentOffsetX: number
  contentOffsetY: number
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

