// Types for the Video Mapper application

export type MediaType = 'video' | 'image'
export type ShapeType = 'rectangle' | 'circle' | 'polygon'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'
export type TextureMode = 'clip' | 'warp'
export type BackgroundType = 'color' | 'image' | 'video'

// Per-corner pixel offsets from the frame's default rectangle corners
// Default (no distortion): all offsets are { x: 0, y: 0 }
export interface PerspectiveCorners {
  tl: Point // offset from top-left  (frame.x,            frame.y)
  tr: Point // offset from top-right (frame.x+frame.width, frame.y)
  br: Point // offset from bot-right (frame.x+frame.width, frame.y+frame.height)
  bl: Point // offset from bot-left  (frame.x,            frame.y+frame.height)
}

// Grid overlay & snapping settings
export interface GridSettings {
  show: boolean
  snap: boolean
  size: number // grid cell size in composition px
  showInPresentation: boolean // keep grid visible in present mode (projector calibration)
}

// Fixed composition (output) resolution — frames are stored in composition
// coordinates so projects are portable across machines/projectors
export interface CompositionSettings {
  width: number
  height: number
}

// When a launcher trigger starts: right away, or on the next beat / bar /
// 2 bars / 4 bars of the master clock (Resolume's Beat Snap)
export type BeatSnap = 'off' | 'beat' | 'bar' | '2bars' | '4bars'

// Master clock settings, saved with the project. The clock's phase (where
// the bar starts) is live state.
export interface TempoSettings {
  bpm: number
  beatsPerBar: number
  beatSnap: BeatSnap // composition default; clips can override it
}

// How a layer changes clips: a dissolve over `duration` seconds — or beats
// of the master clock when `beats` is set. 0 is a cut.
export interface Transition {
  duration: number
  beats?: boolean
}

// Crossfader side of a layer (unset: the crossfader doesn't touch it)
export type CrossfadeSide = 'A' | 'B'

// An ISF shader in an effect stack (clip, layer or composition) or as a
// clip's generator. `effectId` names a shader in the effect library;
// parameters left out use the shader's defaults.
export type EffectParamValue = number | boolean | number[]

export interface EffectInstance {
  id: string
  effectId: string
  enabled: boolean
  params: Record<string, EffectParamValue>
}

export interface GeneratorSettings {
  effectId: string
  params: Record<string, EffectParamValue>
}

// Per-edge feathering (px in frame-local space) for projection blending
export interface SoftEdge {
  left: number
  right: number
  top: number
  bottom: number
}

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

// Media record embedded in an exported project file (base64 data URL)
export interface ExportedMediaRecord {
  id: string
  name: string
  type: MediaType
  mimeType: string
  dataUrl: string
}

// Media library stats
export interface MediaLibraryStats {
  totalSize: number
  count: number
  maxSize: number // max allowed total size
}

// A frame is the editor's / renderers' view of one mapped surface with the
// content its layer currently plays (see state/showModel.ts)
export interface MediaFrame {
  id: string // = surface id
  layerId?: string // the layer feeding this surface (derived, read-only)
  clipId?: string // the layer's playing clip (derived, read-only)
  layerHasClips?: boolean // the layer has clips, even if none plays (derived, read-only)
  transition?: Transition // how the playing clip came in / the layer fades out (derived, read-only)
  crossfade?: CrossfadeSide // the layer's crossfader side (derived, read-only)
  clipEffects?: EffectInstance[] // the playing clip's effect stack (derived, read-only)
  layerEffects?: EffectInstance[] // the layer's effect stack (derived, read-only)
  generator?: GeneratorSettings // the playing clip is a generator (derived, read-only)
  type: MediaType
  url: string
  filename?: string
  name?: string // user-set layer name (falls back to filename)
  visible: boolean // layer visibility (eye toggle)
  testPattern: boolean // render calibration test card instead of media
  softEdge: SoftEdge // per-edge feather for projection blending
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
  // Perspective / corner-pin distortion
  perspectiveMode: boolean
  perspectiveCorners: PerspectiveCorners
}

export interface ProjectData {
  frames: MediaFrame[]
  version: string
}

export interface DragState {
  isDragging: boolean
  frameId: string | null
  startX: number // pointer start (composition coords)
  startY: number
  offsetX: number
  offsetY: number
  // Start positions of every selected frame so group drags move together
  groupStartPositions?: Record<string, Point>
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

export interface ResizeState {
  isResizing: boolean
  frameId: string | null
  handle: ResizeHandle | null
  startX: number // pointer start (composition coords)
  startY: number
  startWidth: number
  startHeight: number
  startFrameX: number
  startFrameY: number
  rotation: number // frame rotation at resize start (degrees)
  // Snapshot of perspective corners at the moment resize started (if perspectiveMode)
  startPerspectiveCorners?: PerspectiveCorners
}

// Rubber-band selection marquee (composition coords)
export interface MarqueeState {
  isActive: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  additive: boolean // shift held — add to existing selection
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

