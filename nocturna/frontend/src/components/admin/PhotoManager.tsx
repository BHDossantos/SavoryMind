'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  venueId: number | null;
  photos: string[];
  onChange: (photos: string[]) => void;
}

/**
 * Drag-drop or click-to-pick photo uploader for an existing venue.
 *
 * New venues need to be saved once (to get an id) before photos can be
 * attached — we render an explanatory placeholder until `venueId` is set.
 */
export function PhotoManager({ venueId, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!venueId) {
    return (
      <div className="text-xs text-gold-400/60 border border-dashed border-white/10 rounded-lg p-4 text-center">
        Save the venue first to enable photo uploads.
      </div>
    );
  }

  async function uploadFiles(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    let current = [...photos];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        try {
          const r = await api.upload<{ photos: string[] }>(`/api/admin/venues/${venueId}/photos`, form);
          current = r.photos;
          onChange(r.photos);
        } catch (e: any) {
          // Per-file error — keep going with the rest so a bad mime doesn't
          // abort a batch upload.
          const detail = e?.data?.detail || e?.message || 'upload failed';
          setError(`${file.name}: ${detail}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url: string) {
    setError(null);
    setBusy(true);
    try {
      const r = await api.del<{ photos: string[] }>(`/api/admin/venues/${venueId}/photos`, { url });
      onChange(r.photos);
    } catch (e: any) {
      setError(e?.data?.detail || e?.message || 'delete failed');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label className="block text-xs text-gold-400/60 mb-1">photos</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-lg p-4 text-center text-xs transition border border-dashed ${
          dragging
            ? 'border-gold-500/60 bg-gold-500/10 text-gold-400'
            : 'border-white/10 text-gold-400/60 hover:border-gold-500/40'
        }`}
      >
        {busy ? 'Uploading…' : 'Drop image files here, or click to pick. Max 5 MB each.'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-accent-500 text-xs mt-2">{error}</p>}
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {photos.map((url) => (
            <li key={url} className="relative group rounded-md overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="venue" className="w-full aspect-[4/3] object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                disabled={busy}
                aria-label="Remove photo"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-night-950/80 border border-white/20 text-gold-400 text-xs opacity-80 hover:opacity-100 hover:bg-accent-500/40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
