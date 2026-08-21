// components/domain/MediaManager.jsx
// Organiser-side media management: upload several files at once, assign
// each to a surface, reorder the gallery, remove one.
//
// Upload is sequential rather than parallel. Several 40MB videos in
// flight at once on a phone connection is how uploads time out, and a
// per-file progress line is more useful than one aggregate bar that
// stalls for a minute.
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { eventsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { CameraIcon, XIcon, CheckIcon, AlertTriangleIcon } from '@/components/icons/Icons';
import './domain.css';

const PLACEMENTS = [
  { id: 'gallery',    label: 'Gallery',            hint: 'Shown as a strip on the event page. Add as many as you like.' },
  { id: 'cover',      label: 'Cover',              hint: 'The card image in listings and search.' },
  { id: 'detail_bg',  label: 'Event page banner',  hint: 'Behind the title on the event page.' },
  { id: 'hero_video', label: 'Hero video',         hint: 'Plays behind the event page title. Video only.' },
  { id: 'ticket_bg',  label: 'Ticket background',  hint: 'Behind the QR code in the attendee wallet.' },
];

export default function MediaManager({ eventId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef(null);
  const [placement, setPlacement] = useState('gallery');
  const [queue, setQueue] = useState([]);      // [{name, status, error}]
  const [dragOver, setDragOver] = useState(false);

  const mediaQuery = useQuery({
    queryKey: ['events', eventId, 'media'],
    queryFn: () => eventsApi.media(eventId),
    enabled: !!eventId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['events', eventId, 'media'] });

  const upload = useCallback(async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    setQueue(list.map((f) => ({ name: f.name, status: 'waiting' })));

    for (let i = 0; i < list.length; i++) {
      setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: 'uploading' } : item)));
      try {
        await eventsApi.uploadMedia(eventId, list[i], placement, '');
        setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: 'done' } : item)));
      } catch (e) {
        // Reported per file. One rejected video should not read as
        // "the upload failed" when four photos went through.
        setQueue((q) => q.map((item, j) => (j === i ? { ...item, status: 'failed', error: apiError(e) } : item)));
      }
    }
    refresh();
    setTimeout(() => setQueue([]), 4000);
  }, [eventId, placement]);

  const remove = useMutation({
    mutationFn: (mediaId) => eventsApi.deleteMedia(eventId, mediaId),
    onSuccess: () => { refresh(); toast.info('Removed.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const move = useMutation({
    mutationFn: ({ mediaId, to }) => eventsApi.updateMedia(eventId, mediaId, { placement: to }),
    onSuccess: () => { refresh(); toast.success('Moved.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const items = mediaQuery.data?.media ?? [];
  const current = PLACEMENTS.find((p) => p.id === placement);

  return (
    <section className="mm" aria-label="Event media">
      <div className="mm__head">
        <h2 className="type-label-mono"><CameraIcon size={14} /> Photos and video</h2>
        {items.length > 0 && <Badge variant="default">{items.length} uploaded</Badge>}
      </div>

      <div className="mm__placements" role="radiogroup" aria-label="Where should the upload go">
        {PLACEMENTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={placement === p.id}
            className={`mm__place ${placement === p.id ? 'mm__place--on' : ''}`}
            onClick={() => setPlacement(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mm__hint">{current?.hint}</p>

      <div
        className={`mm__drop ${dragOver ? 'mm__drop--over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        aria-label={`Upload to ${current?.label}`}
      >
        <CameraIcon size={26} />
        <p className="mm__drop-title">Drop files here, or click to choose</p>
        <p className="mm__drop-sub">JPEG, PNG, WebP up to 8MB · MP4, WebM up to 40MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple={placement === 'gallery'}
          accept="image/*,video/mp4,video/webm"
          hidden
          onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
        />
      </div>

      <AnimatePresence>
        {queue.length > 0 && (
          <motion.ul className="mm__queue" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {queue.map((f, i) => (
              <li key={i} className={`mm__q mm__q--${f.status}`}>
                <span className="mm__q-name">{f.name}</span>
                {f.status === 'uploading' && <Spinner size="sm" />}
                {f.status === 'done' && <CheckIcon size={14} />}
                {f.status === 'failed' && <span className="mm__q-err"><AlertTriangleIcon size={13} /> {f.error}</span>}
                {f.status === 'waiting' && <span className="mm__q-wait">queued</span>}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {mediaQuery.isLoading && <div style={{ padding: 'var(--space-xl)', display: 'grid', placeItems: 'center' }}><Spinner /></div>}

      {items.length > 0 && (
        <div className="mm__grid">
          {items.map((m) => (
            <motion.figure key={m.id} className="mm__tile" layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              {m.kind === 'video'
                ? <video src={m.url} muted playsInline preload="metadata" />
                : <img src={m.url} alt={m.alt_text || ''} loading="lazy" />}
              <figcaption className="mm__tile-bar">
                <select
                  value={m.placement}
                  onChange={(e) => move.mutate({ mediaId: m.id, to: e.target.value })}
                  aria-label={`Placement for ${m.alt_text || m.kind}`}
                >
                  {PLACEMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => remove.mutate(m.id)}
                  aria-label="Remove this file"
                  className="mm__tile-x"
                >
                  <XIcon size={13} />
                </button>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}

      {!mediaQuery.isLoading && items.length === 0 && (
        <p className="mm__empty">
          No photos yet. Listings fall back to a stock image until you add one.
        </p>
      )}
    </section>
  );
}
