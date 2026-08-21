// components/domain/MediaGallery.jsx
// The event's uploaded photos and video, as a slideable strip with a
// lightbox. Organisers could not upload more than one asset before, so
// there was nothing for a gallery to show; now that an event can carry
// a set, this is where visitors actually see it.
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, XIcon, CameraIcon } from '@/components/icons/Icons';
import './domain.css';

function MediaFrame({ item, active, onClick }) {
  return (
    <button
      className={`gal__item ${active ? 'gal__item--active' : ''}`}
      onClick={onClick}
      aria-label={item.alt_text || `Open ${item.kind}`}
      type="button"
    >
      {item.kind === 'youtube' ? (
        <>
          <img src={item.thumbnail} alt={item.alt_text || 'Video thumbnail'} loading="lazy" />
          <span className="gal__play" aria-hidden="true">▶</span>
        </>
      ) : item.kind === 'video' ? (
        <>
          {/* muted + playsInline so it can autoplay as a preview; a
              gallery thumbnail that demands a click to show anything is
              just a grey box. */}
          <video src={item.url} muted loop playsInline preload="metadata" />
          <span className="gal__play" aria-hidden="true">▶</span>
        </>
      ) : (
        <img src={item.url} alt={item.alt_text || ''} loading="lazy" />
      )}
    </button>
  );
}

export default function MediaGallery({ media = [], title = 'Gallery' }) {
  const [open, setOpen] = useState(null);
  const stripRef = useRef(null);

  const items = media.filter((m) => m?.url);

  const step = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  // Arrow keys move through the lightbox, Escape closes it. A lightbox
  // that can only be dismissed with the mouse traps keyboard users.
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

      {/* Horizontal scroll with snap rather than a carousel with dots:
          it works with a trackpad, a touch swipe and the keyboard
          without any of them being special-cased. */}
      <div className="gal__strip" ref={stripRef}>
        {items.map((m, i) => (
          <MediaFrame key={m.id} item={m} active={open === i} onClick={() => setOpen(i)} />
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            className="gal__lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(null)}
            role="dialog"
            aria-modal="true"
            aria-label={items[open]?.alt_text || 'Media viewer'}
          >
            <button className="gal__close" onClick={() => setOpen(null)} aria-label="Close viewer">
              <XIcon size={20} />
            </button>
            <motion.div
              className="gal__stage"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {items[open].kind === 'youtube' ? (
                <iframe
                  className="gal__frame"
                  src={items[open].watch_embed_url + '&autoplay=1'}
                  title={items[open].alt_text || 'Event video'}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : items[open].kind === 'video' ? (
                <video src={items[open].url} controls autoPlay playsInline />
              ) : (
                <img src={items[open].url} alt={items[open].alt_text || ''} />
              )}
            </motion.div>
            {items[open].alt_text && <p className="gal__caption">{items[open].alt_text}</p>}
            <p className="gal__pos">{open + 1} of {items.length}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
