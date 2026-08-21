// components/domain/MediaGallery.jsx
// The visitor-facing half: an event's photos and video as a scrollable
// strip with a lightbox. Organisers could not upload more than one asset
// before, so there was nothing for a gallery to show.
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon, XIcon, CameraIcon } from '@/components/icons/Icons';
import './domain.css';

export default function MediaGallery({ media = [], title = 'Gallery' }) {
  const [open, setOpen] = useState(null);
  const stripRef = useRef(null);
  const items = media.filter((m) => m?.url || m?.thumbnail);

  const step = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  // Arrow keys move through the lightbox, Escape closes it. A lightbox
  // dismissable only by mouse traps keyboard users inside it.
  const onKey = useCallback((e) => {
    if (open === null) return;
    if (e.key === 'Escape') setOpen(null);
    if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % items.length);
    if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + items.length) % items.length);
  }, [open, items.length]);

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    document.body.style.overflow = open !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!items.length) return null;

  return (
    <section className="gal" aria-label={title}>
      <div className="gal__head">
        <h2 className="type-label-mono">
          <CameraIcon size={14} /> {title}
          <span className="gal__count">{items.length}</span>
        </h2>
        {items.length > 2 && (
          <div className="gal__nav">
            <button type="button" onClick={() => step(-1)} aria-label="Scroll gallery left">
              <ChevronDownIcon size={18} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Scroll gallery right">
              <ChevronDownIcon size={18} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal scroll with snap rather than a carousel with dots: it
          works with a trackpad, a swipe and the keyboard without any of
          them being special-cased. */}
      <div className="gal__strip" ref={stripRef}>
        {items.map((m, i) => (
          <button
            key={m.id}
            className="gal__item"
            onClick={() => setOpen(i)}
            aria-label={m.alt_text || `Open ${m.kind}`}
            type="button"
          >
            <img
              src={m.kind === 'youtube' ? m.thumbnail : m.url}
              alt={m.alt_text || ''}
              loading="lazy"
            />
            {m.kind === 'youtube' && <span className="gal__play" aria-hidden="true">▶</span>}
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="gal__lightbox"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label={items[open]?.alt_text || 'Media viewer'}
        >
          <button className="gal__close" onClick={() => setOpen(null)} aria-label="Close viewer">
            <XIcon size={20} />
          </button>
          <div className="gal__stage" onClick={(e) => e.stopPropagation()}>
            {items[open].kind === 'youtube' ? (
              <iframe
                className="gal__frame"
                src={`${items[open].watch_embed_url}&autoplay=1`}
                title={items[open].alt_text || 'Event video'}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                frameBorder="0"
              />
            ) : (
              <img src={items[open].url} alt={items[open].alt_text || ''} />
            )}
          </div>
          <p className="gal__pos">{open + 1} of {items.length}</p>
        </div>
      )}
    </section>
  );
}
