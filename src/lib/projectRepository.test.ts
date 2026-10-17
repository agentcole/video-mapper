import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addVersion, AUTO_VERSIONS_KEPT, closeProjectDB, createProject, deleteProject, duplicateProject,
  getProject, getVersion, listProjects, listVersions, openInitialProject, renameProject, saveProjectData,
} from './projectRepository';

// Minimal localStorage for the "current project" pointer and legacy migration
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
  removeItem(key: string) { this.items.delete(key); }
}

const project = (frames: number) => ({ version: '4.1.0', frames: Array.from({ length: frames }, (_, i) => ({ id: `f${i}` })) });

describe('project repository', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });
  afterEach(async () => {
    await closeProjectDB();
  });

  it('creates, lists (newest first), renames and saves projects', async () => {
    const a = await createProject('A', project(1));
    await new Promise(r => setTimeout(r, 5));
    const b = await createProject('B', project(2));
    expect((await listProjects()).map(p => p.name)).toEqual(['B', 'A']);

    await renameProject(a.id, 'Alpha');
    await saveProjectData(a.id, project(3));
    const saved = await getProject(a.id);
    expect(saved?.name).toBe('Alpha');
    expect(saved?.frameCount).toBe(3);
    expect((await listProjects())[0].id).toBe(a.id);
    expect('data' in (await listProjects())[0]).toBe(false);
    expect(b.frameCount).toBe(2);
  });

  it('duplicates and deletes projects with their versions', async () => {
    const a = await createProject('A', project(1));
    const copy = await duplicateProject(a.id);
    expect(copy.name).toBe('A (copy)');
    await addVersion(a.id, project(1), 'manual');
    await deleteProject(a.id);
    expect(await getProject(a.id)).toBeNull();
    expect(await listVersions(a.id)).toEqual([]);
    expect(await getProject(copy.id)).not.toBeNull();
  });

  it('keeps versions and prunes old automatic ones', async () => {
    const a = await createProject('A', project(0));
    const manual = await addVersion(a.id, project(5), 'manual');
    for (let i = 0; i < AUTO_VERSIONS_KEPT + 3; i++) {
      await addVersion(a.id, project(i), 'auto');
    }
    const versions = await listVersions(a.id);
    expect(versions.filter(v => v.reason === 'auto')).toHaveLength(AUTO_VERSIONS_KEPT);
    expect(versions.some(v => v.id === manual.id)).toBe(true);
    expect((await getVersion(manual.id))?.frameCount).toBe(5);
  });

  it('migrates the legacy single-slot autosave into the first project', async () => {
    localStorage.setItem('video-mapper-project', JSON.stringify(project(4)));
    const record = await openInitialProject();
    expect(record.name).toBe('My project');
    expect(record.frameCount).toBe(4);
    expect(localStorage.getItem('video-mapper-project')).toBeNull();
    expect(localStorage.getItem('video-mapper-project-legacy')).not.toBeNull();
    // Next start reopens the same project
    expect((await openInitialProject()).id).toBe(record.id);
  });

  it('creates an empty project on first start', async () => {
    const record = await openInitialProject();
    expect(record.name).toBe('Untitled project');
    expect(record.data).toBeNull();
  });
});
