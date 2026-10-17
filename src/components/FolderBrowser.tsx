import React, { useEffect, useState } from 'react';
import { FolderPlus, Unlink, RefreshCw, Video, Image as ImageIcon, Folder } from 'lucide-react';
import { Button } from './ui/button';
import type { StoredMedia } from '../types';
import { formatBytes } from '../lib/mediaStorage';
import {
  linkFolder, listLinkedFolders, unlinkFolder, folderPermission, scanFolder,
  type LinkedFolder, type FolderMediaFile,
} from '../lib/mediaFolders';

interface FolderBrowserProps {
  filter: 'all' | 'video' | 'image';
  onSelect: (media: StoredMedia) => void;
}

type FolderState = 'idle' | 'loading' | 'needs-permission' | 'error';

// Linked media folders inside the media library: files play straight from
// disk (no copy, no size limit). Chromium only.
export const FolderBrowser: React.FC<FolderBrowserProps> = ({ filter, onSelect }) => {
  const [folders, setFolders] = useState<LinkedFolder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [files, setFiles] = useState<FolderMediaFile[]>([]);
  const [state, setState] = useState<FolderState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const active = folders.find(f => f.id === activeId) ?? null;

  useEffect(() => {
    let cancelled = false;
    listLinkedFolders()
      .then(found => {
        if (cancelled) return;
        setFolders(found);
        setActiveId(prev => prev ?? found[0]?.id ?? null);
      })
      .catch(error => !cancelled && setMessage((error as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  // Scan the active folder when read permission is (still) granted
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const permission = await folderPermission(active);
      if (cancelled) return;
      if (permission !== 'granted') {
        setFiles([]);
        setState('needs-permission');
        return;
      }
      setState('loading');
      const found = await scanFolder(active);
      if (cancelled) return;
      setFiles(found);
      setState('idle');
    })().catch(error => {
      if (cancelled) return;
      setState('error');
      setMessage((error as Error).message);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const addFolder = async () => {
    setMessage(null);
    try {
      const folder = await linkFolder();
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveId(folder.id);
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setMessage((error as Error).message);
    }
  };

  const reconnect = async () => {
    if (!active) return;
    const permission = await folderPermission(active, true);
    if (permission === 'granted') {
      // Re-run the scan effect with a fresh object
      setFolders(prev => prev.map(f => (f.id === active.id ? { ...f } : f)));
    }
  };

  const removeFolder = async () => {
    if (!active || !confirm(`Unlink "${active.name}"? Layers using its files show nothing until it is linked again.`)) return;
    await unlinkFolder(active.id);
    const rest = folders.filter(f => f.id !== active.id);
    setFolders(rest);
    setActiveId(rest[0]?.id ?? null);
    setFiles([]);
  };

  const visible = files.filter(f => filter === 'all' || f.type === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => setActiveId(folder.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${folder.id === activeId ? 'bg-cyan-500 text-black font-semibold' : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'}`}
          >
            <Folder className="w-3.5 h-3.5" />
            {folder.name}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={addFolder}>
          <FolderPlus /> Link folder…
        </Button>
        {active && (
          <Button variant="outline" size="sm" onClick={removeFolder} title="Forget this folder">
            <Unlink />
          </Button>
        )}
      </div>

      {message && <p className="text-xs text-red-300">{message}</p>}

      {folders.length === 0 ? (
        <p className="text-xs text-gray-400 max-w-lg">
          Link a folder with your show media to play files straight from disk — nothing is copied into the
          browser, and there is no size limit. Layers keep pointing at the files by their path in the folder.
        </p>
      ) : state === 'needs-permission' ? (
        <div className="flex items-center gap-3 text-xs text-gray-300">
          <span>The browser needs your OK to read “{active?.name}” again.</span>
          <Button size="sm" onClick={reconnect}>
            <RefreshCw /> Reconnect
          </Button>
        </div>
      ) : state === 'loading' ? (
        <p className="text-xs text-gray-400">Scanning “{active?.name}”…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-400">No {filter === 'all' ? 'video or image' : filter} files in this folder.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {visible.map(file => (
            <button
              key={file.id}
              onClick={() => onSelect({
                id: file.id,
                name: file.name,
                type: file.type,
                mimeType: file.mimeType,
                size: file.size,
                blob: file.file,
                dateAdded: file.lastModified,
              })}
              className="aspect-video bg-neutral-800 rounded p-2 flex flex-col items-start justify-between text-left ring-1 ring-white/10 hover:ring-2 hover:ring-cyan-400 transition-shadow"
              title={file.path}
            >
              {file.type === 'video' ? <Video className="w-6 h-6 text-white/30" /> : <ImageIcon className="w-6 h-6 text-white/30" />}
              <div className="w-full min-w-0">
                <p className="text-[11px] text-white truncate font-medium">{file.name}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {formatBytes(file.size)}{file.path.includes('/') ? ` · ${file.path.slice(0, file.path.lastIndexOf('/'))}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
