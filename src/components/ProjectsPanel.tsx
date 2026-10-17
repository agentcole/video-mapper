import React, { useCallback, useEffect, useState } from 'react';
import { X, FolderKanban, Plus, Copy, Trash2, Pencil, History, RotateCcw, Save } from 'lucide-react';
import { Button } from './ui/button';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-700 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold">Projects</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {error && <p className="mx-4 mt-3 p-2 rounded bg-red-900/50 border border-red-700 text-sm text-red-200">{error}</p>}

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Projects */}
          <section className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-700">
            <div className="flex items-center justify-between p-3">
              <p className="text-xs uppercase font-semibold text-slate-400">All projects</p>
              <Button size="sm" onClick={() => run(() => session.newProject())}>
                <Plus className="w-4 h-4 mr-1" /> New project
              </Button>
            </div>
            <ul className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {projects.map(p => (
                <li
                  key={p.id}
                  className={`group rounded-lg px-3 py-2 flex items-center gap-2 ${p.id === currentId ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'hover:bg-white/5'}`}
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
                        className="w-full bg-black/40 rounded px-2 py-0.5 text-sm"
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
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {p.frameCount} layer{p.frameCount === 1 ? '' : 's'} · changed {timeAgo(p.updatedAt)}
                          {p.id === currentId && ' · open'}
                        </p>
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                    <button
                      className="p-1 rounded hover:bg-white/10"
                      title="Rename"
                      onClick={() => {
                        setRenamingId(p.id);
                        setRenameValue(p.name);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded hover:bg-white/10" title="Duplicate" onClick={() => run(() => session.duplicate(p.id))}>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-red-500/40"
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
            <div className="flex items-center justify-between p-3">
              <p className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Versions of “{session.project?.name ?? '—'}”
              </p>
              <Button size="sm" variant="outline" onClick={() => run(() => session.saveVersion())}>
                <Save className="w-4 h-4 mr-1" /> Save version
              </Button>
            </div>
            {versions.length === 0 ? (
              <p className="px-3 text-sm text-slate-500">
                No versions yet. A version is kept automatically every 5 minutes while you work, and whenever you save one.
              </p>
            ) : (
              <ul className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                {versions.map(v => (
                  <li key={v.id} className="rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{new Date(v.createdAt).toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">
                        <span className={`px-1 rounded ${v.reason === 'manual' ? 'bg-blue-600/40' : 'bg-white/10'}`}>{REASON_LABEL[v.reason]}</span>
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
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
