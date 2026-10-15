import { z } from 'zod';
import type {
  MediaFrame, BackgroundSettings, GridSettings, CompositionSettings, ExportedMediaRecord,
} from '../types';
import {
  DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION, DEFAULT_PERSPECTIVE_CORNERS, DEFAULT_SOFT_EDGE,
} from './defaults';
import { pinFrameToQuadVertices } from './geometry';

// ---------------------------------------------------------------------------
// Project file format: validation + migrations
//
// Every project that enters the app (autosave, import) goes through
// parseProjectData. Fields added over time get their defaults from the
// schema; semantic changes run as versioned migrations. A broken layer (NaN
// geometry, unknown shape, …) is skipped with a warning instead of taking
// the whole output down.
// ---------------------------------------------------------------------------

export const PROJECT_VERSION = '4.1.0';

const PointSchema = z.object({ x: z.number(), y: z.number() });

const CornersSchema = z.object({
  tl: PointSchema,
  tr: PointSchema,
  br: PointSchema,
  bl: PointSchema,
});

const SoftEdgeSchema = z.object({
  left: z.number().min(0),
  right: z.number().min(0),
  top: z.number().min(0),
  bottom: z.number().min(0),
});

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
] as const;

const FrameSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['video', 'image']),
  url: z.string().default(''),
  filename: z.string().optional(),
  name: z.string().optional(),
  visible: z.boolean().default(true),
  testPattern: z.boolean().default(false),
  softEdge: SoftEdgeSchema.default(DEFAULT_SOFT_EDGE),
  mediaId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  shape: z.enum(['rectangle', 'circle', 'polygon']).default('rectangle'),
  vertices: z.array(PointSchema).min(3).optional(),
  textureMode: z.enum(['clip', 'warp']).default('clip'),
  loop: z.boolean().default(true),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().default(0),
  playbackRate: z.number().positive().default(1),
  muted: z.boolean().default(false),
  blur: z.number().min(0).default(0),
  brightness: z.number().min(0).default(100),
  contrast: z.number().min(0).default(100),
  grayscale: z.number().min(0).default(0),
  saturate: z.number().min(0).default(100),
  hueRotate: z.number().default(0),
  invert: z.number().min(0).default(0),
  sepia: z.number().min(0).default(0),
  blendMode: z.enum(BLEND_MODES).default('normal'),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
  lockAspectRatio: z.boolean().default(true),
  contentScale: z.number().positive().default(1),
  contentOffsetX: z.number().default(0),
  contentOffsetY: z.number().default(0),
  perspectiveMode: z.boolean().default(false),
  perspectiveCorners: CornersSchema.default(DEFAULT_PERSPECTIVE_CORNERS),
}).refine(f => f.shape !== 'polygon' || (f.vertices?.length ?? 0) >= 3, {
  message: 'polygon without vertices',
  path: ['vertices'],
});

const BackgroundSchema = z.object({
  type: z.enum(['color', 'image', 'video']),
  color: z.string(),
  url: z.string().optional(),
  mediaId: z.string().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
});

const GridSchema = z.object({
  show: z.boolean().default(DEFAULT_GRID.show),
  snap: z.boolean().default(DEFAULT_GRID.snap),
  size: z.number().int().min(1).default(DEFAULT_GRID.size),
  showInPresentation: z.boolean().default(DEFAULT_GRID.showInPresentation),
});

const CompositionSchema = z.object({
  width: z.number().int().min(16).max(16384).default(DEFAULT_COMPOSITION.width),
  height: z.number().int().min(16).max(16384).default(DEFAULT_COMPOSITION.height),
});

const MediaRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(['video', 'image']),
  mimeType: z.string(),
  dataUrl: z.string().startsWith('data:'),
});

export interface ParsedProject {
  frames: MediaFrame[];
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
  media?: ExportedMediaRecord[];
  // Human-readable notes about what was skipped or repaired
  warnings: string[];
}

// ---- Versioned migrations ---------------------------------------------------

/** Compare dotted version strings numerically ('4.10.0' > '4.9.0'). */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

interface FrameMigration {
  // Applies to projects saved before this version
  before: string;
  migrate: (frame: MediaFrame) => MediaFrame;
}

const FRAME_MIGRATIONS: FrameMigration[] = [
  {
    // The old "warp" texture mode stretched media onto a 4-vertex polygon
    // with a second homography. It is now a corner-pinned rectangle whose
    // pins sit on those vertices (one homography per frame); anything else
    // just clips.
    before: '4.1.0',
    migrate: (frame) => {
      if (frame.textureMode !== 'warp') return frame;
      const pinned = frame.shape === 'polygon' ? pinFrameToQuadVertices(frame) : null;
      return pinned ? { ...frame, ...pinned } : { ...frame, textureMode: 'clip' };
    },
  },
];

const migrateFrame = (frame: MediaFrame, fromVersion: string): MediaFrame =>
  FRAME_MIGRATIONS.reduce(
    (f, m) => (compareVersions(fromVersion, m.before) < 0 ? m.migrate(f) : f),
    frame
  );

// ---- Parsing -----------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describeIssue = (error: z.ZodError): string => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join('.') || 'value'}: ${issue.message}` : 'invalid';
};

/**
 * Validate and migrate raw project data (parsed JSON). Throws only when the
 * data isn't a project at all; individual bad layers/settings are skipped or
 * replaced by defaults and reported in `warnings`.
 */
export const parseProjectData = (raw: unknown): ParsedProject => {
  if (!isRecord(raw) || !Array.isArray(raw.frames)) {
    throw new Error('Invalid project file format');
  }
  const warnings: string[] = [];
  // Files without a version predate versioning (treated as oldest)
  const version = typeof raw.version === 'string' ? raw.version : '0.0.0';
  if (compareVersions(version, PROJECT_VERSION) > 0) {
    warnings.push(`Saved by a newer version (${version}); unknown settings were ignored.`);
  }

  const frames: MediaFrame[] = [];
  raw.frames.forEach((value, index) => {
    const result = FrameSchema.safeParse(value);
    if (!result.success) {
      const label = isRecord(value) && typeof value.name === 'string' ? `"${value.name}"` : `#${index + 1}`;
      warnings.push(`Layer ${label} was skipped (${describeIssue(result.error)}).`);
      return;
    }
    frames.push(migrateFrame(result.data as MediaFrame, version));
  });

  let background = DEFAULT_BACKGROUND;
  if (raw.background !== undefined) {
    const result = BackgroundSchema.safeParse(raw.background);
    if (result.success) background = result.data;
    else warnings.push(`Background was reset (${describeIssue(result.error)}).`);
  }

  const gridResult = GridSchema.safeParse(isRecord(raw.grid) ? raw.grid : {});
  const grid = gridResult.success ? gridResult.data : DEFAULT_GRID;
  if (!gridResult.success) warnings.push('Grid settings were reset.');

  const compositionResult = CompositionSchema.safeParse(isRecord(raw.composition) ? raw.composition : {});
  const composition = compositionResult.success ? compositionResult.data : DEFAULT_COMPOSITION;
  if (!compositionResult.success) {
    warnings.push(`Composition size was reset to ${composition.width} × ${composition.height}.`);
  }

  let media: ExportedMediaRecord[] | undefined;
  if (Array.isArray(raw.media)) {
    media = [];
    for (const value of raw.media) {
      const result = MediaRecordSchema.safeParse(value);
      if (result.success) media.push(result.data);
      else warnings.push('An embedded media file was skipped (unreadable record).');
    }
  }

  return { frames, background, grid, composition, media, warnings };
};
