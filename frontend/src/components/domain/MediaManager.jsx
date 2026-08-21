// components/domain/MediaManager.jsx
// Organiser-side media management: upload several files at once, assign
// each to a surface, reorder the gallery, remove one.
//
// Upload is sequential rather than parallel. Several 40MB videos in
// flight at once on a phone connection is how uploads time out, and a
// per-file progress line is more useful than one aggregate bar that
// stalls for a minute.
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { eventsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { CameraIcon, XIcon, CheckIcon, AlertTriangleIcon } from '@/components/icons/Icons';
import './domain.css';

const PLACEMENTS = [
  { id: 'gallery',    label: 'Gallery',            hint: 'Shown as a strip on the event page. Photos, or YouTube links.', youtube: true },
  { id: 'cover',      label: 'Cover',              hint: 'The card image in listings and search.' },
  { id: 'detail_bg',  label: 'Event page banner',  hint: 'Behind the title on the event page.' },
  { id: 'hero_video', label: 'Hero video',         hint: 'Plays behind the event page title. Paste a YouTube link — videos are not uploaded, so they cost no bandwidth.', youtube: true },
  { id: 'ticket_bg',  label: 'Ticket background',  hint: 'Behind the QR code in the attendee wallet.' },
];

// One tile. Dragging is started from the handle rather than the whole
// tile, so the placement select and the remove button stay usable --
// a drag surface covering the entire card swallows every click on it.
//
// The arrow keys move a tile too. Drag-and-drop with no keyboard path
// is an ordering feature that simply does not exist for anyone not
// using a mouse.
function MediaTile({ item, index, total, onCommit, onNudge, onPlacement, onRemove }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      className="mm__tile"
      as="figure"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileDrag={{ scale: 1.04, zIndex: 2, cursor: 'grabbing' }}
    >
      <button
        type="button"
        className="mm__grip"
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onNudge(-1); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onNudge(1); }
        }}
        aria-label={`Reorder ${item.alt_text || item.kind}, position ${index + 1} of ${total}. Use arrow keys to move.`}
      >
        <GripIcon />
      </button>

      <span className="mm__pos" aria-hidden="true">{index + 1}</span>

      {item.kind === 'youtube'
        ? <img src={item.thumbnail} alt={item.alt_text || 'Video thumbnail'} loading="lazy" draggable={false} />
        : item.kind === 'video'
          ? <video src={item.url} muted playsInline preload="metadata" />
          : <img src={item.url} alt={item.alt_text || ''} loading="lazy" draggable={false} />}
      {item.kind === 'youtube' && <span className="mm__yt-flag">YouTube</span>}

      <figcaption className="mm__tile-bar">
        <select
          value={item.placement}
          onChange={(e) => onPlacement(e.target.value)}
          aria-label={`Placement for ${item.alt_text || item.kind}`}
        >
          {PLACEMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button type="button" onClick={onRemove} aria-label="Remove this file" className="mm__tile-x">
          <XIcon size={13} />
        </button>
      </figcaption>
    </Reorder.Item>
  );
}

// Six dots: the conventional grip. Drawn here rather than added to the
// icon set because nothing else needs it.
function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      {[2, 8].map((x) => [3, 8, 13].map((y) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />
      )))}
    </svg>
  );
}

export default function MediaManager({ eventId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef(null);
  const [placement, setPlacement] = useState('gallery');
  const [queue, setQueue] = useState([]);      // [{name, status, error}]
  const [dragOver, setDragOver] = useState(false);
  const [ytUrl, setYtUrl] = useState('');

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

  // Videos are linked, not uploaded. Object storage charges for every
  // byte served and a looping hero is the heaviest request a page can
  // make; YouTube absorbs that for nothing.
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

  // Memoised against the query data, not recreated per render. As a
  // bare `data?.media ?? []` this was a new array identity every pass,
  // so the effect below re-fired on its own output and the component
  // hit "Maximum update depth exceeded" in a tight loop.
  const items = useMemo(() => mediaQuery.data?.media ?? [], [mediaQuery.data]);
  const current = PLACEMENTS.find((p) => p.id === placement);

  // Gallery order is the order visitors see, so it needs to be settable.
  // The list is held locally while dragging: reordering through the
  // query cache would make each item snap back to its server position
  // between frames, which is unusable.
  const [order, setOrder] = useState([]);
  useEffect(() => { setOrder(items); }, [items]);

  const reorder = useMutation({
    mutationFn: (ids) => eventsApi.reorderMedia(eventId, ids),
    onSuccess: () => { refresh(); toast.success('Order saved.'); },
    // On failure the local order is the lie, so it is discarded and the
    // server's answer put back rather than left looking saved.
    onError: (e) => { setOrder(items); toast.error(apiError(e)); },
  });

  const commitOrder = (next) => {
    const before = items.map((m) => m.id).join(',');
    const after = next.map((m) => m.id).join(',');
    if (before !== after) reorder.mutate(next.map((m) => m.id));
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
        <form
          className="mm__yt"
          onSubmit={(e) => { e.preventDefault(); if (ytUrl.trim()) attachYt.mutate(); }}
        >
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
            <Button
              type="submit"
              variant="secondary"
              isDisabled={!ytUrl.trim()}
              isLoading={attachYt.isPending}
            >
              Attach
            </Button>
          </div>
        </form>
      )}

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

      {order.length > 0 && (
        <>
          {order.length > 1 && (
            <p className="mm__reorder-hint">
              Drag a tile to change the order visitors see. Keyboard: focus a tile and use the arrow keys.
            </p>
          )}
          <Reorder.Group
            axis="x"
            values={order}
            onReorder={setOrder}
            className="mm__grid"
            as="div"
          >
            {order.map((m, index) => (
              <MediaTile
                key={m.id}
                item={m}
                index={index}
                total={order.length}
                onCommit={() => commitOrder(order)}
                onNudge={(delta) => {
                  const next = [...order];
                  const target = index + delta;
                  if (target < 0 || target >= next.length) return;
                  [next[index], next[target]] = [next[target], next[index]];
                  setOrder(next);
                  commitOrder(next);
                }}
                onPlacement={(to) => move.mutate({ mediaId: m.id, to })}
                onRemove={() => remove.mutate(m.id)}
              />
            ))}
          </Reorder.Group>
        </>
      )}

      {!mediaQuery.isLoading && items.length === 0 && (
        <p className="mm__empty">
          No photos yet. Listings fall back to a stock image until you add one.
        </p>
      )}
    </section>
  );
}
