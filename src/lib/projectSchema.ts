import { z } from 'zod';
import type {
  MediaFrame, BackgroundSettings, GridSettings, CompositionSettings, ExportedMediaRecord, TempoSettings,
  EffectInstance, Macro, ModMap, Screen, Slice,
} from '../types';
import {
  DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION, DEFAULT_MACROS, DEFAULT_PERSPECTIVE_CORNERS,
  DEFAULT_SOFT_EDGE, DEFAULT_TEMPO,
} from './defaults';
import { MAX_BPM, MIN_BPM } from '../state/clock';
import { pinFrameToQuadVertices } from './geometry';
import { MAX_SCREEN_SIZE, MIN_SLICE_SIZE } from '../state/screens';
import {
  createColumns, emptyShow, framesFromShow, showFromFrames,
  type Clip, type Column, type Layer, type ShowDocument, type Surface,
} from '../state/showModel';

// ---------------------------------------------------------------------------
// Project file format: validation + migrations
//
// Every project that enters the app (autosave, import) goes through
// parseProjectData. Fields added over time get their defaults from the
// schema; semantic changes run as versioned migrations. A broken layer (NaN
// geometry, unknown shape, …) is skipped with a warning instead of taking
// the whole output down.
//
// Format 5 stores surfaces + layers (clips in columns); older files store
// frames and are converted (one layer + clip per frame).
// ---------------------------------------------------------------------------

// 5.1: clips have a trigger style (clip launcher)
// 5.2: master clock (tempo) and beat snap per composition / clip
// 5.3: transitions per layer / clip, crossfader side per layer
// 5.4: ISF effect stacks (clip, layer, composition) and generator clips
// 5.5: parameter modulation (LFO, audio, macros) and macro faders
// 5.6: screens (outputs) with slices of the composition
export const PROJECT_VERSION = '5.6.0';

const BEAT_SNAPS = ['off', 'beat', 'bar', '2bars', '4bars'] as const;

// 5.3 — a broken transition falls back to the default (cut / the layer's)
const TransitionSchema = z.object({
  duration: z.number().min(0).max(600),
  beats: z.boolean().optional(),
}).optional().catch(undefined);

// 5.5 — modulations: a broken (or newer) one is dropped, the others stay
const ModSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('lfo'),
    shape: z.enum(['sine', 'triangle', 'saw', 'ramp', 'square', 'pulse', 'random']),
    period: z.number().positive().max(3600),
    beats: z.boolean().optional(),
    phase: z.number().min(0).max(1).optional(),
    width: z.number().min(0).max(1).optional(),
  }),
  z.object({ kind: z.literal('audio'), band: z.enum(['level', 'bass', 'mid', 'high', 'kick']) }),
  z.object({ kind: z.literal('macro'), index: z.number().int().min(0).max(63) }),
]);
const ModulationSchema = z.object({
  source: ModSourceSchema,
  amount: z.number().min(-1).max(1),
});
const ModsSchema = z.record(z.string(), z.unknown()).transform((entries): ModMap | undefined => {
  const mods: ModMap = {};
  for (const [key, value] of Object.entries(entries)) {
    const result = ModulationSchema.safeParse(value);
    if (result.success) mods[key] = result.data;
  }
  return Object.keys(mods).length > 0 ? mods : undefined;
}).optional().catch(undefined);

// 5.4 — effects: a broken entry is dropped, the rest of the stack stays
const ParamValueSchema = z.union([z.number(), z.boolean(), z.array(z.number())]);
const ParamsSchema = z.record(z.string(), ParamValueSchema).catch({});
const EffectSchema = z.object({
  id: z.string().min(1),
  effectId: z.string().min(1),
  enabled: z.boolean().default(true),
  params: ParamsSchema.default({}),
  mods: ModsSchema,
});
const EffectsSchema = z.array(z.unknown()).transform(items => items.flatMap(item => {
  const result = EffectSchema.safeParse(item);
  return result.success ? [result.data] : [];
})).optional().catch(undefined);
const GeneratorSchema = z.object({
  effectId: z.string().min(1),
  params: ParamsSchema.default({}),
  mods: ModsSchema,
}).optional().catch(undefined);

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

// ---- Format 5: surfaces, layers, clips, columns ----

const SurfaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  layerId: z.string().min(1),
  visible: z.boolean().default(true),
  testPattern: z.boolean().default(false),
  zIndex: z.number().default(0),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  shape: z.enum(['rectangle', 'circle', 'polygon']).default('rectangle'),
  vertices: z.array(PointSchema).min(3).optional(),
  lockAspectRatio: z.boolean().default(true),
  perspectiveMode: z.boolean().default(false),
  perspectiveCorners: CornersSchema.default(DEFAULT_PERSPECTIVE_CORNERS),
  softEdge: SoftEdgeSchema.default(DEFAULT_SOFT_EDGE),
}).refine(s => s.shape !== 'polygon' || (s.vertices?.length ?? 0) >= 3, {
  message: 'polygon without vertices',
  path: ['vertices'],
});

const ClipSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  // 5.1 — an unknown style (newer file) falls back to normal instead of losing the clip
  triggerStyle: z.enum(['normal', 'toggle', 'piano']).optional().catch(undefined),
  // 5.2 — unset: the composition's beat snap
  beatSnap: z.enum(BEAT_SNAPS).optional().catch(undefined),
  transition: TransitionSchema,
  effects: EffectsSchema,
  generator: GeneratorSchema,
  source: z.object({
    type: z.enum(['video', 'image']),
    url: z.string().default(''),
    mediaId: z.string().optional(),
    filename: z.string().optional(),
  }),
  loop: z.boolean().default(true),
  playbackRate: z.number().positive().default(1),
  muted: z.boolean().default(false),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
  contentScale: z.number().positive().default(1),
  contentOffsetX: z.number().default(0),
  contentOffsetY: z.number().default(0),
  blur: z.number().min(0).default(0),
  brightness: z.number().min(0).default(100),
  contrast: z.number().min(0).default(100),
  grayscale: z.number().min(0).default(0),
  saturate: z.number().min(0).default(100),
  hueRotate: z.number().default(0),
  invert: z.number().min(0).default(0),
  sepia: z.number().min(0).default(0),
});

const LayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Layer'),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.enum(BLEND_MODES).default('normal'),
  slots: z.array(z.unknown()).default([]), // clips are validated one by one
  activeClipId: z.string().nullable().default(null),
  transition: TransitionSchema,
  crossfade: z.enum(['A', 'B']).optional().catch(undefined),
  effects: EffectsSchema,
  mods: ModsSchema,
});

const ColumnSchema = z.object({ id: z.string().min(1), name: z.string().default('') });

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

// Each setting falls back on its own: a bad value doesn't reset the others
const TempoSchema = z.object({
  bpm: z.number().min(MIN_BPM).max(MAX_BPM).catch(DEFAULT_TEMPO.bpm),
  beatsPerBar: z.number().int().min(1).max(16).catch(DEFAULT_TEMPO.beatsPerBar),
  beatSnap: z.enum(BEAT_SNAPS).catch(DEFAULT_TEMPO.beatSnap),
});

// 5.5 — macro faders: always all of them; a bad one gets its default
const MacroSchema = z.object({
  name: z.string().max(40),
  value: z.number().min(0).max(1),
});
const parseMacros = (raw: unknown): Macro[] =>
  DEFAULT_MACROS.map((fallback, i) => {
    const result = MacroSchema.safeParse(Array.isArray(raw) ? raw[i] : undefined);
    return result.success ? result.data : fallback;
  });

// 5.6 — screens and their slices. A broken slice or screen is skipped
const SliceSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80).catch('Slice'),
  enabled: z.boolean().catch(true),
  input: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(MIN_SLICE_SIZE),
    height: z.number().min(MIN_SLICE_SIZE),
  }),
  output: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]),
});
const ScreenSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80).catch('Screen'),
  width: z.number().int().min(16).max(MAX_SCREEN_SIZE),
  height: z.number().int().min(16).max(MAX_SCREEN_SIZE),
  slices: z.array(z.unknown()).catch([]),
});
const parseScreens = (raw: unknown, warnings: string[]): Screen[] => {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const screens: Screen[] = [];
  raw.forEach((value, i) => {
    const result = ScreenSchema.safeParse(value);
    if (!result.success || ids.has(result.data.id)) {
      warnings.push(`Screen ${i + 1} was skipped (${result.success ? 'duplicate id' : describeIssue(result.error)}).`);
      return;
    }
    ids.add(result.data.id);
    const slices: Slice[] = [];
    result.data.slices.forEach((sliceValue, j) => {
      const slice = SliceSchema.safeParse(sliceValue);
      if (!slice.success || ids.has(slice.data.id)) {
        warnings.push(`Slice ${j + 1} of ${result.data.name} was skipped (${slice.success ? 'duplicate id' : describeIssue(slice.error)}).`);
        return;
      }
      ids.add(slice.data.id);
      slices.push(slice.data);
    });
    screens.push({ ...result.data, slices });
  });
  return screens;
};

const CompositionSchema = z.object({
  width: z.number().int().min(16).max(16384).default(DEFAULT_COMPOSITION.width),
  height: z.number().int().min(16).max(16384).default(DEFAULT_COMPOSITION.height),
});

// Media files stored next to project.json in a project package (zip)
const PackageMediaSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(['video', 'image']),
  mimeType: z.string(),
  path: z.string().min(1),
});

export type PackageMediaEntry = z.infer<typeof PackageMediaSchema>;

const MediaRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(['video', 'image']),
  mimeType: z.string(),
  dataUrl: z.string().startsWith('data:'),
});

export interface ParsedProject extends ShowDocument {
  frames: MediaFrame[]; // derived view of the show (surface ⨝ layer ⨝ active clip)
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
  tempo: TempoSettings;
  effects: EffectInstance[]; // composition effect stack
  macros: Macro[];
  screens: Screen[];
  shaders: { id: string; name: string; source: string }[]; // imported ISF shaders the project uses
  media?: ExportedMediaRecord[]; // legacy: base64-embedded media
  mediaFiles?: PackageMediaEntry[]; // project packages: media files in the zip
  name?: string; // project name stored in exported files
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
/** Format ≤ 4: frames, converted into one layer + clip per frame. */
const parseLegacyFrames = (rawFrames: unknown[], version: string, warnings: string[]): ShowDocument => {
  const frames: MediaFrame[] = [];
  rawFrames.forEach((value, index) => {
    const result = FrameSchema.safeParse(value);
    if (!result.success) {
      const label = isRecord(value) && typeof value.name === 'string' ? `"${value.name}"` : `#${index + 1}`;
      warnings.push(`Layer ${label} was skipped (${describeIssue(result.error)}).`);
      return;
    }
    frames.push(migrateFrame(result.data as MediaFrame, version));
  });
  return showFromFrames(emptyShow(), frames);
};

/** Format 5: surfaces + layers + columns, each entry validated on its own. */
const parseShow = (raw: Record<string, unknown>, warnings: string[]): ShowDocument => {
  const columns: Column[] = [];
  if (Array.isArray(raw.columns)) {
    for (const value of raw.columns) {
      const result = ColumnSchema.safeParse(value);
      if (result.success) columns.push(result.data);
    }
  }
  if (columns.length === 0) columns.push(...createColumns());

  const layers: Layer[] = [];
  for (const value of Array.isArray(raw.layers) ? raw.layers : []) {
    const result = LayerSchema.safeParse(value);
    if (!result.success) {
      warnings.push(`A layer was skipped (${describeIssue(result.error)}).`);
      continue;
    }
    const { slots: rawSlots, ...layer } = result.data;
    const slots: (Clip | null)[] = rawSlots.map(slot => {
      if (slot === null || slot === undefined) return null;
      const clip = ClipSchema.safeParse(slot);
      if (clip.success) return clip.data;
      warnings.push(`A clip in "${layer.name}" was skipped (${describeIssue(clip.error)}).`);
      return null;
    });
    while (slots.length < columns.length) slots.push(null);
    const activeClipId = slots.some(c => c?.id === layer.activeClipId) ? layer.activeClipId : null;
    layers.push({ ...layer, slots, activeClipId });
  }

  const layerIds = new Set(layers.map(l => l.id));
  const surfaces: Surface[] = [];
  (Array.isArray(raw.surfaces) ? raw.surfaces : []).forEach((value, index) => {
    const result = SurfaceSchema.safeParse(value);
    if (!result.success) {
      const label = isRecord(value) && typeof value.name === 'string' ? `"${value.name}"` : `#${index + 1}`;
      warnings.push(`Surface ${label} was skipped (${describeIssue(result.error)}).`);
      return;
    }
    const surface = result.data;
    // Keep the mapping even if its layer is gone: give it an empty layer
    if (!layerIds.has(surface.layerId)) {
      warnings.push(`Surface "${surface.name ?? surface.id}" lost its layer; an empty one was created.`);
      layers.push({ id: surface.layerId, name: surface.name ?? 'Layer', opacity: 1, blendMode: 'normal', slots: columns.map(() => null), activeClipId: null });
      layerIds.add(surface.layerId);
    }
    surfaces.push(surface);
  });

  return { surfaces, layers, columns };
};

export const parseProjectData = (raw: unknown): ParsedProject => {
  const isShow = isRecord(raw) && (Array.isArray(raw.surfaces) || Array.isArray(raw.layers));
  if (!isRecord(raw) || (!isShow && !Array.isArray(raw.frames))) {
    throw new Error('Invalid project file format');
  }
  const warnings: string[] = [];
  // Files without a version predate versioning (treated as oldest)
  const version = typeof raw.version === 'string' ? raw.version : '0.0.0';
  if (compareVersions(version, PROJECT_VERSION) > 0) {
    warnings.push(`Saved by a newer version (${version}); unknown settings were ignored.`);
  }

  const show = isShow
    ? parseShow(raw, warnings)
    : parseLegacyFrames(raw.frames as unknown[], version, warnings);
  const frames = framesFromShow(show);

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

  const tempo = isRecord(raw.tempo) ? TempoSchema.parse(raw.tempo) : DEFAULT_TEMPO;
  const effects = EffectsSchema.parse(raw.effects) ?? [];
  const macros = parseMacros(raw.macros);
  const screens = parseScreens(raw.screens, warnings);
  const shaders = Array.isArray(raw.shaders)
    ? raw.shaders.flatMap(s => (isRecord(s) && typeof s.id === 'string' && typeof s.source === 'string'
      ? [{ id: s.id, name: typeof s.name === 'string' ? s.name : s.id, source: s.source }]
      : []))
    : [];

  let media: ExportedMediaRecord[] | undefined;
  if (Array.isArray(raw.media)) {
    media = [];
    for (const value of raw.media) {
      const result = MediaRecordSchema.safeParse(value);
      if (result.success) media.push(result.data);
      else warnings.push('An embedded media file was skipped (unreadable record).');
    }
  }

  let mediaFiles: PackageMediaEntry[] | undefined;
  if (Array.isArray(raw.mediaFiles)) {
    mediaFiles = [];
    for (const value of raw.mediaFiles) {
      const result = PackageMediaSchema.safeParse(value);
      if (result.success) mediaFiles.push(result.data);
      else warnings.push('A packaged media file was skipped (unreadable entry).');
    }
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined;

  return { ...show, frames, background, grid, composition, tempo, effects, macros, screens, shaders, media, mediaFiles, name, warnings };
};
