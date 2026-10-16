import React, { useCallback, useEffect, useState } from 'react';
import { FolderKanban, Plus, Copy, Trash2, Pencil, History, RotateCcw, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { field, iconButton, sectionLabel } from './ui/theme';
import { listProjects, listVersions, renameProject, type ProjectSummary, type VersionSummary } from '../lib/projectRepository';
import type { ProjectSession } from '../state/useProjectSession';

interface ProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: ProjectSession;
}

const timeAgo = (timestamp: number): string => {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const REASON_LABEL: Record<VersionSummary['reason'], string> = {
  auto: 'auto',
  manual: 'saved',
  'before-restore': 'before restore',
};

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({ isOpen, onClose, session }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentId = session.project?.id;

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setVersions(currentId ? await listVersions(currentId) : []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [currentId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([listProjects(), currentId ? listVersions(currentId) : Promise.resolve([])])
      .then(([allProjects, allVersions]) => {
        if (cancelled) return;
        setProjects(allProjects);
        setVersions(allVersions);
      })
      .catch(err => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentId]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    }
    await refresh();
  };

  const commitRename = (project: ProjectSummary) => run(async () => {
    setRenamingId(null);
    const name = renameValue.trim();
    if (!name || name === project.name) return;
    if (project.id === currentId) await session.renameCurrent(name);
    else await renameProject(project.id, name);
  });

  if (!isOpen) return null;

  return (
    <Dialog title="Projects" icon={<FolderKanban className="w-4 h-4" />} onClose={onClose} closeOnBackdrop>
      {error && <p className="mx-3 mt-2 px-3 py-2 rounded bg-red-600/20 ring-1 ring-red-500/60 text-xs text-red-200">{error}</p>}

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Projects */}
        <section className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center justify-between px-3 py-2">
            <p className={sectionLabel}>All projects</p>
            <Button variant="outline" size="sm" onClick={() => run(() => session.newProject())}>
              <Plus /> New project
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {projects.map(p => (
              <li
                key={p.id}
                className={`group rounded px-2 py-1.5 flex items-center gap-2 ${p.id === currentId ? 'bg-cyan-500/15 ring-1 ring-cyan-400/70' : 'hover:bg-white/5'}`}
              >
                <div className="flex-1 min-w-0">
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(p);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className={`w-full ${field}`}
                    />
                  ) : (
                    <button
                      className="text-left w-full"
                      onClick={() => p.id !== currentId && run(async () => {
                        await session.openProject(p.id);
                        onClose();
                      })}
                      title={p.id === currentId ? 'Open now' : 'Open this project'}
                    >
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.frameCount} layer{p.frameCount === 1 ? '' : 's'} · changed {timeAgo(p.updatedAt)}
                        {p.id === currentId && ' · open'}
                      </p>
                    </button>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                  <button
                    className={iconButton}
                    title="Rename"
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className={iconButton} title="Duplicate" onClick={() => run(() => session.duplicate(p.id))}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-red-600 transition-colors"
                    title="Delete project"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}" and all its versions? Media in the library is kept.`)) {
                        void run(() => session.removeProject(p.id));
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Versions of the open project */}
        <section className="flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className={`${sectionLabel} flex items-center gap-1 min-w-0 truncate`}>
              <History className="w-3 h-3 shrink-0" /> Versions of “{session.project?.name ?? '—'}”
            </p>
            <Button size="sm" variant="outline" onClick={() => run(() => session.saveVersion())}>
              <Save /> Save version
            </Button>
          </div>
          {versions.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-gray-500">
              No versions yet. A version is kept automatically every 5 minutes while you work, and whenever you save one.
            </p>
          ) : (
            <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
              {versions.map(v => (
                <li key={v.id} className="rounded px-2 py-1.5 flex items-center gap-2 hover:bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">{new Date(v.createdAt).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">
                      <span className={`px-1 rounded-sm uppercase text-[9px] ${v.reason === 'manual' ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/10'}`}>{REASON_LABEL[v.reason]}</span>
                      {' '}{v.frameCount} layer{v.frameCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(async () => {
                      await session.restoreVersion(v.id);
                      onClose();
                    })}
                    title="Restore — the current state is kept as a version first"
                  >
                    <RotateCcw /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
};
