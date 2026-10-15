import { openDatabase, promisify, transactionDone, describeStorageError } from './idb';

// ---------------------------------------------------------------------------
// Project repository (IndexedDB): many projects, each with its own version
// history, plus linked media folders. Replaces the single localStorage
// autosave slot (≈5 MB, one project, nothing to go back to).
//
// Project data is the serialized project JSON (see serializeProject); it is
// validated with parseProjectData whenever it is opened.
// ---------------------------------------------------------------------------

const DB_NAME = 'video-mapper-projects';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const VERSIONS = 'versions';
export const FOLDERS = 'folders';

const CURRENT_PROJECT_KEY = 'video-mapper-current-project';
// The pre-repository autosave slot, migrated into the first project
const LEGACY_PROJECT_KEY = 'video-mapper-project';
const LEGACY_BACKUP_KEY = 'video-mapper-project-legacy';

export const AUTO_VERSIONS_KEPT = 20;
export const MANUAL_VERSIONS_KEPT = 50;

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  frameCount: number;
  data: unknown;
}

export type ProjectSummary = Omit<ProjectRecord, 'data'>;

export type VersionReason = 'auto' | 'manual' | 'before-restore';

export interface ProjectVersion {
  id: string;
  projectId: string;
  createdAt: number;
  reason: VersionReason;
  frameCount: number;
  data: unknown;
}

export type VersionSummary = Omit<ProjectVersion, 'data'>;

let dbPromise: Promise<IDBDatabase> | null = null;

export const getProjectDB = (): Promise<IDBDatabase> => {
  dbPromise ??= openDatabase(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(PROJECTS)) {
      db.createObjectStore(PROJECTS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(VERSIONS)) {
      db.createObjectStore(VERSIONS, { keyPath: 'id' }).createIndex('projectId', 'projectId');
    }
    if (!db.objectStoreNames.contains(FOLDERS)) {
      db.createObjectStore(FOLDERS, { keyPath: 'id' });
    }
  });
  return dbPromise;
};

/** Close and forget the connection (tests). */
export const closeProjectDB = async () => {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
};

// Surfaces in format 5, frames before
const frameCountOf = (data: unknown): number => {
  const d = data as { surfaces?: unknown; frames?: unknown } | null;
  if (Array.isArray(d?.surfaces)) return d.surfaces.length;
  return Array.isArray(d?.frames) ? d.frames.length : 0;
};

const withoutData = <T extends { data: unknown }>(record: T): Omit<T, 'data'> => {
  const { data, ...rest } = record;
  void data;
  return rest;
};

// ---- Projects ----------------------------------------------------------------

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getProjectDB();
  const all = await promisify(db.transaction(PROJECTS).objectStore(PROJECTS).getAll() as IDBRequest<ProjectRecord[]>);
  return all.map(withoutData).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const db = await getProjectDB();
  const record = await promisify(db.transaction(PROJECTS).objectStore(PROJECTS).get(id) as IDBRequest<ProjectRecord | undefined>);
  return record ?? null;
}

const putProject = async (record: ProjectRecord): Promise<void> => {
  const db = await getProjectDB();
  const tx = db.transaction(PROJECTS, 'readwrite');
  tx.objectStore(PROJECTS).put(record);
  try {
    await transactionDone(tx);
  } catch (error) {
    throw describeStorageError(error);
  }
};

export async function createProject(name: string, data: unknown = null): Promise<ProjectRecord> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    frameCount: frameCountOf(data),
    data,
  };
  await putProject(record);
  return record;
}

export async function saveProjectData(id: string, data: unknown): Promise<void> {
  const existing = await getProject(id);
  if (!existing) throw new Error('The project no longer exists');
  await putProject({ ...existing, data, frameCount: frameCountOf(data), updatedAt: Date.now() });
}

export async function renameProject(id: string, name: string): Promise<void> {
  const existing = await getProject(id);
  if (!existing) throw new Error('The project no longer exists');
  await putProject({ ...existing, name, updatedAt: Date.now() });
}

export async function duplicateProject(id: string): Promise<ProjectRecord> {
  const existing = await getProject(id);
  if (!existing) throw new Error('The project no longer exists');
  return createProject(`${existing.name} (copy)`, existing.data);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getProjectDB();
  const versionKeys = await promisify(db.transaction(VERSIONS).objectStore(VERSIONS).index('projectId').getAllKeys(id));
  const tx = db.transaction([PROJECTS, VERSIONS], 'readwrite');
  tx.objectStore(PROJECTS).delete(id);
  versionKeys.forEach(key => tx.objectStore(VERSIONS).delete(key));
  await transactionDone(tx);
  if (getCurrentProjectId() === id) setCurrentProjectId(null);
}

// ---- Versions ----------------------------------------------------------------

const versionsOf = async (projectId: string): Promise<ProjectVersion[]> => {
  const db = await getProjectDB();
  const index = db.transaction(VERSIONS).objectStore(VERSIONS).index('projectId');
  const all = await promisify(index.getAll(projectId) as IDBRequest<ProjectVersion[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
};

export async function listVersions(projectId: string): Promise<VersionSummary[]> {
  return (await versionsOf(projectId)).map(withoutData);
}

export async function getVersion(id: string): Promise<ProjectVersion | null> {
  const db = await getProjectDB();
  const version = await promisify(db.transaction(VERSIONS).objectStore(VERSIONS).get(id) as IDBRequest<ProjectVersion | undefined>);
  return version ?? null;
}

/** Store a version and prune old ones (automatic and manual are kept separately). */
export async function addVersion(projectId: string, data: unknown, reason: VersionReason): Promise<VersionSummary> {
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    projectId,
    createdAt: Date.now(),
    reason,
    frameCount: frameCountOf(data),
    data,
  };
  const db = await getProjectDB();
  const tx = db.transaction(VERSIONS, 'readwrite');
  tx.objectStore(VERSIONS).put(version);
  try {
    await transactionDone(tx);
  } catch (error) {
    throw describeStorageError(error);
  }

  const all = await versionsOf(projectId);
  const manual = all.filter(v => v.reason === 'manual');
  const automatic = all.filter(v => v.reason !== 'manual');
  const stale = [...manual.slice(MANUAL_VERSIONS_KEPT), ...automatic.slice(AUTO_VERSIONS_KEPT)];
  if (stale.length > 0) {
    const pruneTx = db.transaction(VERSIONS, 'readwrite');
    stale.forEach(v => pruneTx.objectStore(VERSIONS).delete(v.id));
    await transactionDone(pruneTx);
  }
  return withoutData(version);
}

// ---- Current project -----------------------------------------------------------

export const getCurrentProjectId = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  } catch {
    return null;
  }
};

export const setCurrentProjectId = (id: string | null): void => {
  try {
    if (id) localStorage.setItem(CURRENT_PROJECT_KEY, id);
    else localStorage.removeItem(CURRENT_PROJECT_KEY);
  } catch {
    // storage unavailable — the most recent project opens next time
  }
};

/**
 * The project to open at startup: the last open one, else the migrated
 * legacy autosave, else the most recently changed one, else a new one.
 */
export async function openInitialProject(): Promise<ProjectRecord> {
  const currentId = getCurrentProjectId();
  if (currentId) {
    const current = await getProject(currentId);
    if (current) return current;
  }

  let record: ProjectRecord | null = null;
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(LEGACY_PROJECT_KEY);
  } catch {
    legacy = null;
  }
  if (legacy) {
    let data: unknown = null;
    try {
      data = JSON.parse(legacy);
    } catch {
      // Unreadable: start empty; the raw text stays in the backup key
    }
    record = await createProject('My project', data);
    try {
      localStorage.setItem(LEGACY_BACKUP_KEY, legacy);
      localStorage.removeItem(LEGACY_PROJECT_KEY);
    } catch {
      // keep the legacy key if we can't back it up
    }
  } else {
    const [latest] = await listProjects();
    record = latest ? await getProject(latest.id) : null;
  }
  record ??= await createProject('Untitled project');
  setCurrentProjectId(record.id);
  return record;
}
