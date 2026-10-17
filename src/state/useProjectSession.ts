import { useCallback, useEffect, useRef, useState } from 'react';
import { projectStore, type ProjectDocument } from './projectStore';
import { emptyShow, mapClips } from './showModel';
import { projectHistory } from './history';
import { parseProjectData } from '../lib/projectSchema';
import {
  serializeProject, exportProjectJson, exportProjectPackage, importProjectFile, type LoadedProject,
  DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION, DEFAULT_TEMPO,
} from '../lib/storage';
import {
  openInitialProject, getProject, createProject, saveProjectData, renameProject, deleteProject,
  duplicateProject, listProjects, addVersion, getVersion, setCurrentProjectId, type ProjectRecord,
} from '../lib/projectRepository';
import { resolveMediaUrls } from '../lib/mediaStorage';
import { describeStorageError } from '../lib/idb';

// ---------------------------------------------------------------------------
// Project session: which project is open, autosave into the repository,
// automatic + manual versions, switching, import/export. The document itself
// lives in the project store; this hook only moves it in and out.
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY_MS = 1000;
const AUTO_VERSION_INTERVAL_MS = 5 * 60 * 1000;
const NOTICE_MS = 3500;

const { replaceDocument } = projectStore.getState();

const documentOf = (d: ProjectDocument): ProjectDocument => ({
  surfaces: d.surfaces,
  layers: d.layers,
  columns: d.columns,
  background: d.background,
  grid: d.grid,
  composition: d.composition,
  tempo: d.tempo,
});

const currentDocument = (): ProjectDocument => documentOf(projectStore.getState());

/** Turn stored media references (every clip + background) into playable URLs for this window. */
const resolveDocument = async (project: LoadedProject): Promise<ProjectDocument> => {
  const doc = documentOf(project);
  const mediaIds = [
    ...doc.layers.flatMap(l => l.slots.map(c => c?.source.mediaId)),
    doc.background.mediaId,
  ].filter((id): id is string => Boolean(id));
  if (mediaIds.length === 0) return doc;
  try {
    const urls = await resolveMediaUrls([...new Set(mediaIds)]);
    const withUrls = mapClips(doc, clip => {
      const id = clip.source.mediaId;
      return id && urls.has(id) ? { ...clip, source: { ...clip.source, url: urls.get(id)! } } : clip;
    });
    return {
      ...withUrls,
      background: doc.background.mediaId && urls.has(doc.background.mediaId)
        ? { ...doc.background, url: urls.get(doc.background.mediaId) }
        : doc.background,
    };
  } catch (error) {
    console.error('Failed to resolve media URLs:', error);
    return doc;
  }
};

const EMPTY_DOCUMENT: ProjectDocument = {
  ...emptyShow(),
  background: DEFAULT_BACKGROUND,
  grid: DEFAULT_GRID,
  composition: DEFAULT_COMPOSITION,
  tempo: DEFAULT_TEMPO,
};

// One initial load per page (StrictMode runs effects twice in development)
let initialProject: Promise<ProjectRecord> | null = null;

export interface CurrentProject {
  id: string;
  name: string;
}

export function useProjectSession(onDocumentReplaced: () => void) {
  const [project, setProject] = useState<CurrentProject | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const projectIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoVersionRef = useRef(0);
  // No autosave until a project is open, and none while switching projects
  const suspendedRef = useRef(true);
  const onReplacedRef = useRef(onDocumentReplaced);
  useEffect(() => {
    onReplacedRef.current = onDocumentReplaced;
  }, [onDocumentReplaced]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const id = projectIdRef.current;
    if (!id || suspendedRef.current) return;
    const data = serializeProject(currentDocument());
    try {
      await saveProjectData(id, data);
      setAutosaveError(null);
      if (Date.now() - lastAutoVersionRef.current >= AUTO_VERSION_INTERVAL_MS) {
        lastAutoVersionRef.current = Date.now();
        await addVersion(id, data, 'auto');
      }
    } catch (error) {
      setAutosaveError(describeStorageError(error).message);
    }
  }, []);

  // Autosave: debounce document changes
  useEffect(() => projectStore.subscribe((state, prev) => {
    if (suspendedRef.current) return;
    if (
      state.surfaces === prev.surfaces && state.layers === prev.layers && state.columns === prev.columns &&
      state.background === prev.background && state.grid === prev.grid && state.composition === prev.composition &&
      state.tempo === prev.tempo
    ) {
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
  }), [saveNow]);

  // Best effort: flush a pending save when the tab is hidden or closed
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) void saveNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [saveNow]);

  /** Make a stored project the open one. Unreadable data is never overwritten. */
  const applyRecord = useCallback(async (initial: ProjectRecord, extraWarnings: string[] = []) => {
    suspendedRef.current = true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    let record = initial;
    const warnings = [...extraWarnings];
    let parsed: LoadedProject | null = null;
    if (record.data != null) {
      try {
        parsed = parseProjectData(record.data);
        warnings.push(...parsed.warnings);
      } catch (error) {
        warnings.push(`"${record.name}" could not be read (${(error as Error).message}) and was left untouched; a new project was opened instead.`);
        record = await createProject(`${record.name} (new)`);
      }
    }
    replaceDocument(parsed ? await resolveDocument(parsed) : EMPTY_DOCUMENT);
    projectIdRef.current = record.id;
    setCurrentProjectId(record.id);
    setProject({ id: record.id, name: record.name });
    projectHistory.reset();
    lastAutoVersionRef.current = Date.now();
    if (warnings.length > 0) console.warn('Project opened with warnings:', warnings);
    setLoadWarnings(warnings);
    onReplacedRef.current();
    suspendedRef.current = false;
  }, []);

  // Open the last project on startup (migrating the old autosave slot)
  useEffect(() => {
    let cancelled = false;
    initialProject ??= openInitialProject();
    initialProject
      .then(record => (cancelled ? undefined : applyRecord(record)))
      .catch(error => {
        console.error('Failed to open the project repository:', error);
        setAutosaveError(`projects can't be stored in this browser (${describeStorageError(error).message})`);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyRecord]);

  const openProject = useCallback(async (id: string) => {
    await saveNow();
    const record = await getProject(id);
    if (record) await applyRecord(record);
  }, [saveNow, applyRecord]);

  const newProject = useCallback(async (name = 'Untitled project') => {
    await saveNow();
    await applyRecord(await createProject(name));
  }, [saveNow, applyRecord]);

  const renameCurrent = useCallback(async (name: string) => {
    const id = projectIdRef.current;
    if (!id || !name.trim()) return;
    await renameProject(id, name.trim());
    setProject({ id, name: name.trim() });
  }, []);

  const removeProject = useCallback(async (id: string) => {
    await deleteProject(id);
    if (id !== projectIdRef.current) return;
    // The open project was deleted: switch to the most recent other one
    projectIdRef.current = null;
    const [next] = await listProjects();
    const record = next ? await getProject(next.id) : null;
    await applyRecord(record ?? await createProject('Untitled project'));
  }, [applyRecord]);

  const duplicate = useCallback((id: string) => duplicateProject(id), []);

  const saveVersion = useCallback(async () => {
    await saveNow();
    const id = projectIdRef.current;
    if (!id) return;
    try {
      await addVersion(id, serializeProject(currentDocument()), 'manual');
      flash('Version saved');
    } catch (error) {
      setAutosaveError(describeStorageError(error).message);
    }
  }, [saveNow, flash]);

  /** Restore a version (the current state is kept as a version first; undoable). */
  const restoreVersion = useCallback(async (versionId: string) => {
    const id = projectIdRef.current;
    const version = await getVersion(versionId);
    if (!id || !version) return;
    await addVersion(id, serializeProject(currentDocument()), 'before-restore');
    const parsed = parseProjectData(version.data);
    replaceDocument(await resolveDocument(parsed));
    onReplacedRef.current();
    flash('Version restored — Cmd/Ctrl+Z undoes it');
  }, [flash]);

  /** Import a project file as a new project (never overwrites the open one). */
  const importFile = useCallback(async (file: File) => {
    const { project: imported, name } = await importProjectFile(file);
    await saveNow();
    const record = await createProject(name, serializeProject(documentOf(imported), name));
    await applyRecord(record, imported.warnings);
    flash(`Imported as new project "${name}"`);
  }, [saveNow, applyRecord, flash]);

  const exportJson = useCallback(() => {
    exportProjectJson(currentDocument(), project?.name ?? 'project');
  }, [project]);

  const exportPackage = useCallback(async () => {
    flash('Building project package…');
    const { missing } = await exportProjectPackage(currentDocument(), project?.name ?? 'project');
    flash(missing.length > 0
      ? `Package exported — ${missing.length} media file(s) could not be read`
      : 'Package exported');
  }, [project, flash]);

  return {
    project,
    isLoaded,
    autosaveError,
    dismissAutosaveError: () => setAutosaveError(null),
    loadWarnings,
    dismissLoadWarnings: () => setLoadWarnings([]),
    notice,
    openProject,
    newProject,
    renameCurrent,
    removeProject,
    duplicate,
    saveVersion,
    restoreVersion,
    importFile,
    exportJson,
    exportPackage,
  };
}

export type ProjectSession = ReturnType<typeof useProjectSession>;
