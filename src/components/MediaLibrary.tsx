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
  MAX_TOTAL_SIZE,
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

interface MediaLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (media: StoredMedia) => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
}) => {
  const [mediaList, setMediaList] = useState<StoredMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');
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
    if (confirm('Delete this media file?')) {
      try {
        await deleteMedia(id);
        await loadMedia();
      } catch (err) {
        setError('Failed to delete media');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Delete ALL media files? This cannot be undone.')) {
      try {
        await clearAllMedia();
        await loadMedia();
      } catch (err) {
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

  const storagePercentage = (totalSize / MAX_TOTAL_SIZE) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Media Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Storage Bar */}
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              <span>
                {formatBytes(totalSize)} / {formatBytes(MAX_TOTAL_SIZE)} used ({mediaCount} files)
              </span>
            </div>
            <span className="text-xs">Max file: {formatBytes(MAX_FILE_SIZE)}</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                storagePercentage > 90
                  ? 'bg-red-500'
                  : storagePercentage > 70
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, storagePercentage)}%` }}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'video' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('video')}
            >
              <Video className="w-4 h-4 mr-1" />
              Videos
            </Button>
            <Button
              variant={filter === 'image' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('image')}
            >
              <ImageIcon className="w-4 h-4 mr-1" />
              Images
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
            {mediaCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
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

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-red-200">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className={`flex-1 overflow-y-auto p-4 ${
            dragOver ? 'bg-blue-900/20' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <Upload className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No media files</p>
              <p className="text-sm text-slate-500 text-center max-w-xs">
                Drag and drop video or image files here, or click Upload to add
                media to your library
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filteredMedia.map((media) => (
                <div
                  key={media.id}
                  onClick={() => handleSelect(media)}
                  className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                >
                  {/* Thumbnail */}
                  {media.thumbnail ? (
                    <img
                      src={media.thumbnail}
                      alt={media.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-700">
                      {media.type === 'video' ? (
                        <Video className="w-8 h-8 text-slate-500" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white uppercase font-medium">
                    {media.type}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(media.id, e)}
                    className="absolute top-1 right-1 p-1 rounded bg-red-600/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] text-white truncate font-medium">
                      {media.name}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {formatBytes(media.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drop Overlay */}
          {dragOver && (
            <div className="absolute inset-4 border-2 border-dashed border-blue-500 rounded-xl bg-blue-900/20 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Upload className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                <p className="text-blue-300 font-medium">Drop files to upload</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
