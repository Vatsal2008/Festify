// components/domain/MediaManager.jsx
// Organiser-side media: upload several files at once, assign each to a
// surface, reorder the gallery, remove one.
//
// Uploads run one at a time rather than in parallel. Several large files
// in flight at once on a phone connection is how uploads time out, and a
// per-file line says more than one aggregate bar that stalls.
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { eventsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { CameraIcon, XIcon, CheckIcon, AlertTriangleIcon } from '@/components/icons/Icons';
import './domain.css';

const PLACEMENTS = [
  { id: 'gallery',    label: 'Gallery',           hint: 'A strip on the event page. Photos, or YouTube links.', youtube: true },
  { id: 'cover',      label: 'Cover',             hint: 'The card image in listings and search.' },
  { id: 'detail_bg',  label: 'Event page banner', hint: 'Behind the title on the event page.' },
  { id: 'hero_video', label: 'Hero video',        hint: 'Plays behind the event page title. Paste a YouTube link — videos are not uploaded, so they cost no bandwidth.', youtube: true },
  { id: 'ticket_bg',  label: 'Ticket background', hint: 'Behind the QR code in the attendee wallet.' },
];

export default function MediaManager({ eventId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef(null);
  const [placement, setPlacement] = useState('gallery');
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [dragIndex, setDragIndex] = useState(null);

  const mediaQuery = useQuery({
    queryKey: ['events', eventId, 'media'],
    queryFn: () => eventsApi.media(eventId),
    enabled: !!eventId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['events', eventId, 'media'] });

  // Memoised against the query data. As a bare `data?.media ?? []` this
  // is a new array identity every render, so the effect below would
  // re-fire on its own output and loop.
  const items = useMemo(() => mediaQuery.data?.media ?? [], [mediaQuery.data]);
  const current = PLACEMENTS.find((p) => p.id === placement);

  // Order is held locally while dragging: reordering through the query
  // cache would snap each tile back to its server position mid-drag.
  const [order, setOrder] = useState([]);
  useEffect(() => { setOrder(items); }, [items]);

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

  // Videos are linked, not uploaded. Object storage bills every byte
  // served and a looping hero is the heaviest request a page can make.
  const attachYt = useMutation({
    mutationFn: () => eventsApi.attachYoutube(eventId, ytUrl, placement),
    onSuccess: () => { setYtUrl(''); refresh(); toast.success('Video attached.'); },
    onError: (e) => toast.error(apiError(e)),
  });

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

  const reorder = useMutation({
    mutationFn: (ids) => eventsApi.reorderMedia(eventId, ids),
    onSuccess: () => { refresh(); toast.success('Order saved.'); },
    // On failure the local order is the lie, so it goes back to the
    // server's answer rather than sitting there looking saved.
    onError: (e) => { setOrder(items); toast.error(apiError(e)); },
  });

  const commit = (next) => {
    setOrder(next);
    if (next.map((m) => m.id).join() !== items.map((m) => m.id).join()) {
      reorder.mutate(next.map((m) => m.id));
    }
  };

  // Native HTML5 drag, so no dependency is added for this. Arrow keys do
  // the same job: drag-and-drop with no keyboard path is an ordering
  // feature that does not exist for anyone not using a mouse.
  const dropOn = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    commit(next);
  };

  const nudge = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

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
        <p className="mm__drop-sub">JPEG, PNG, WebP or AVIF, up to 8MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple={placement === 'gallery'}
          accept="image/*"
          hidden
          onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
        />
      </div>

      {current?.youtube && (
        <form className="mm__yt" onSubmit={(e) => { e.preventDefault(); if (ytUrl.trim()) attachYt.mutate(); }}>
          <label className="mm__yt-label" htmlFor="yt-url">Or paste a YouTube link</label>
          <div className="mm__yt-row">
            <input
              id="yt-url"
              type="url"
              className="input-field"
              placeholder="https://youtube.com/watch?v=…"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            <Button type="submit" variant="secondary" isDisabled={!ytUrl.trim()} isLoading={attachYt.isPending}>
              Attach
            </Button>
          </div>
        </form>
      )}

      {queue.length > 0 && (
        <ul className="mm__queue">
          {queue.map((f, i) => (
            <li key={i} className={`mm__q mm__q--${f.status}`}>
              <span className="mm__q-name">{f.name}</span>
              {f.status === 'done' && <CheckIcon size={14} />}
              {f.status === 'failed' && <span className="mm__q-err"><AlertTriangleIcon size={13} /> {f.error}</span>}
              {f.status === 'waiting' && <span className="mm__q-wait">queued</span>}
              {f.status === 'uploading' && <span className="mm__q-wait">uploading…</span>}
            </li>
          ))}
        </ul>
      )}

      {order.length > 1 && (
        <p className="mm__reorder-hint">
          Drag a tile to change the order visitors see. Keyboard: focus the grip and use the arrow keys.
        </p>
      )}

      {order.length > 0 && (
        <div className="mm__grid">
          {order.map((m, index) => (
            <figure
              key={m.id}
              className={`mm__tile ${dragIndex === index ? 'mm__tile--dragging' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(index)}
            >
              <button
                type="button"
                className="mm__grip"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nudge(index, -1); }
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nudge(index, 1); }
                }}
                aria-label={`Reorder ${m.alt_text || m.kind}, position ${index + 1} of ${order.length}. Arrow keys move it.`}
              >
                ⠿
              </button>
              <span className="mm__pos" aria-hidden="true">{index + 1}</span>

              {m.kind === 'youtube'
                ? <img src={m.thumbnail} alt={m.alt_text || 'Video thumbnail'} loading="lazy" draggable={false} />
                : <img src={m.url} alt={m.alt_text || ''} loading="lazy" draggable={false} />}
              {m.kind === 'youtube' && <span className="mm__yt-flag">YouTube</span>}

              <figcaption className="mm__tile-bar">
                <select
                  value={m.placement}
                  onChange={(e) => move.mutate({ mediaId: m.id, to: e.target.value })}
                  aria-label={`Placement for ${m.alt_text || m.kind}`}
                >
                  {PLACEMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <button type="button" onClick={() => remove.mutate(m.id)} aria-label="Remove this file" className="mm__tile-x">
                  <XIcon size={13} />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!mediaQuery.isLoading && items.length === 0 && (
        <p className="mm__empty">No photos yet. Listings fall back to a stock image until you add one.</p>
      )}
    </section>
  );
}
