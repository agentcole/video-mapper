import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StoredMedia, MediaType } from '../types';
import {
  getAllMedia,
  storeMedia,
  deleteMedia,
  clearAllMedia,
  getStorageStats,
  formatBytes,
  MAX_FILE_SIZE,
} from '../lib/mediaStorage';
import {
  X,
  Trash2,
  Upload,
  Video,
  Image as ImageIcon,
  HardDrive,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { iconButton, segment, segmented } from './ui/theme';
import { FolderBrowser } from './FolderBrowser';
import { supportsLinkedFolders } from '../lib/mediaFolders';

interface MediaLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (media: StoredMedia) => void;
  getMediaUsage?: (mediaId: string) => string[]; // layer names using a media
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  getMediaUsage,
}) => {
  const [mediaList, setMediaList] = useState<StoredMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [maxSize, setMaxSize] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');
  // Library = copies in browser storage; folders = files played from disk
  const [source, setSource] = useState<'library' | 'folders'>('library');
  const canLinkFolders = supportsLinkedFolders();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const media = await getAllMedia();
      setMediaList(media.sort((a, b) => b.dateAdded - a.dateAdded));
      const stats = await getStorageStats();
      setTotalSize(stats.totalSize);
      setMaxSize(stats.maxSize);
      setMediaCount(stats.count);
    } catch (err) {
      setError('Failed to load media library');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, loadMedia]);

  const handleFileUpload = async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
        setError(`${file.name} is not a valid video or image file`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} exceeds the ${formatBytes(MAX_FILE_SIZE)} file size limit`);
        continue;
      }

      try {
        const type: MediaType = file.type.startsWith('video/') ? 'video' : 'image';
        await storeMedia(file, file.name, type);
      } catch (err) {
        setError((err as Error).message);
      }
    }

    await loadMedia();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFileUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const users = getMediaUsage?.(id) ?? [];
    const message = users.length > 0
      ? `This media is used by ${users.length} layer${users.length === 1 ? '' : 's'}: ${users.join(', ')}.\n\nDeleting it removes the media from ${users.length === 1 ? 'that layer' : 'those layers'} after the next reload. Delete anyway?`
      : 'Delete this media file?';
    if (confirm(message)) {
      try {
        await deleteMedia(id);
        await loadMedia();
      } catch {
        setError('Failed to delete media');
      }
    }
  };

  const handleClearAll = async () => {
    const usedCount = mediaList.filter(m => (getMediaUsage?.(m.id).length ?? 0) > 0).length;
    const message = usedCount > 0
      ? `Delete ALL media files? ${usedCount} of them are used by layers in this project and will be lost. This cannot be undone.`
      : 'Delete ALL media files? This cannot be undone.';
    if (confirm(message)) {
      try {
        await clearAllMedia();
        await loadMedia();
      } catch {
        setError('Failed to clear media');
      }
    }
  };

  const handleSelect = (media: StoredMedia) => {
    onSelectMedia(media);
    onClose();
  };

  const filteredMedia = mediaList.filter((m) => {
    if (filter === 'all') return true;
    return m.type === filter;
  });

  const storagePercentage = maxSize > 0 ? (totalSize / maxSize) * 100 : 0;

  if (!isOpen) return null;

  return (
    <Dialog title="Media Library" icon={<FolderOpen className="w-4 h-4" />} onClose={onClose}>
      {/* Storage */}
      <div className="px-3 py-2 border-b border-white/10 text-xs">
        <div className="flex items-center justify-between text-gray-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            {formatBytes(totalSize)} of {formatBytes(maxSize)} browser storage ({mediaCount} files)
          </span>
          <span className="text-gray-500">Max file {formatBytes(MAX_FILE_SIZE)}</span>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              storagePercentage > 90 ? 'bg-red-500' : storagePercentage > 70 ? 'bg-amber-400' : 'bg-cyan-400'
            }`}
            style={{ width: `${Math.min(100, storagePercentage)}%` }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10">
        {canLinkFolders && (
          <div className={segmented}>
            <button onClick={() => setSource('library')} className={segment(source === 'library')}>
              Library
            </button>
            <button
              onClick={() => setSource('folders')}
              className={segment(source === 'folders')}
              title="Play files straight from a folder on disk"
            >
              Folders
            </button>
          </div>
        )}
        <div className={segmented}>
          <button onClick={() => setFilter('all')} className={segment(filter === 'all')}>All</button>
          <button onClick={() => setFilter('video')} className={segment(filter === 'video')}>
            <Video className="w-3.5 h-3.5" /> Videos
          </button>
          <button onClick={() => setFilter('image')} className={segment(filter === 'image')}>
            <ImageIcon className="w-3.5 h-3.5" /> Images
          </button>
        </div>
        <div className="flex gap-2 ml-auto" style={{ display: source === 'folders' ? 'none' : undefined }}>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload /> Upload
          </Button>
          {mediaCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="hover:bg-red-600">
              <Trash2 /> Clear all
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-600/20 ring-1 ring-red-500/60 rounded flex items-center gap-2 text-xs text-red-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className={`ml-auto ${iconButton}`} title="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className={`relative flex-1 overflow-y-auto p-3 ${dragOver ? 'bg-cyan-500/10' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {source === 'folders' ? (
          <FolderBrowser filter={filter} onSelect={handleSelect} />
        ) : loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full" />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12 text-xs">
            <Upload className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-semibold text-white mb-1">No media files</p>
            <p className="text-gray-500 text-center max-w-xs">
              Drop video or image files here, or click Upload to add media to your library
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {filteredMedia.map((media) => (
              <div
                key={media.id}
                onClick={() => handleSelect(media)}
                className="group relative aspect-video bg-neutral-800 rounded overflow-hidden cursor-pointer ring-1 ring-white/10 hover:ring-2 hover:ring-cyan-400 transition-shadow"
              >
                {media.thumbnail ? (
                  <img src={media.thumbnail} alt={media.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30">
                    {media.type === 'video' ? <Video className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                  </div>
                )}

                <span className="absolute top-1 left-1 bg-black/70 rounded-sm px-1 text-[9px] uppercase text-gray-300">
                  {media.type}
                </span>

                <button
                  onClick={(e) => handleDelete(media.id, e)}
                  className="absolute top-1 right-1 p-1 rounded bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete from the library"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-0.5 flex items-baseline gap-1.5">
                  <span className="flex-1 text-[10px] leading-tight text-white truncate">{media.name}</span>
                  <span className="text-[9px] text-gray-400 shrink-0">{formatBytes(media.size)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {dragOver && (
          <div className="absolute inset-3 border-2 border-dashed border-cyan-400 rounded-lg bg-cyan-500/10 flex items-center justify-center pointer-events-none">
            <div className="text-center text-cyan-200 text-sm">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              Drop files to upload
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
