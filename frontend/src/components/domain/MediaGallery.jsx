// components/domain/MediaGallery.jsx
// The visitor-facing media strip: video first, then photos.
//
// A YouTube item plays INLINE with YouTube's own controls — play/pause,
// the settings gear (quality, speed) and the captions button when the
// video has them. Those come from the standard embed, so the one thing
// this must not do is pass controls=0.
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon, XIcon } from '@/components/icons/Icons';
import './domain.css';

export default function MediaGallery({ media = [], title }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const stripRef = useRef(null);

  // Video first, photos after — the order the strip presents, not the
  // order they were uploaded in.
  const items = useMemo(() => {
    const usable = (media ?? []).filter((m) => m && (m.url || m.thumbnail));
    const rank = (m) => (m.kind === 'youtube' || m.kind === 'video' ? 0 : 1);
    return [...usable].sort((a, b) => rank(a) - rank(b));
  }, [media]);

  const count = items.length;
  const current = items[Math.min(index, Math.max(0, count - 1))];
  const isVideo = current?.kind === 'youtube' || current?.kind === 'video';

  const go = useCallback((next) => {
    if (!count) return;
    setIndex(((next % count) + count) % count);
  }, [count]);

  // Arrow keys move through the strip; Escape leaves the lightbox. A
  // slider only reachable by mouse is not a slider for everyone.
  const onKey = useCallback((e) => {
    if (e.key === 'Escape' && lightbox) { setLightbox(false); return; }
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  }, [index, go, lightbox]);

  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  // Keep the active thumbnail in view as the slide changes.
  useEffect(() => {
    const el = stripRef.current?.children?.[index];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [index]);

  if (!count) return null;

  return (
    <section className="gal" aria-label={title || 'Event media'} onKeyDown={onKey}>
      {/* No heading by default: a bare "Gallery" label above obvious
          photographs is a caption for something nobody needed named. */}
      {title && <h2 className="type-label-mono gal__title">{title}</h2>}

      <div className="gal__stage">
        {isVideo ? (
          current.kind === 'youtube' ? (
            <iframe
              key={current.id}
              className="gal__media"
              src={current.watch_embed_url}
              title={current.alt_text || 'Event video'}
              // Everything YouTube's own chrome needs to be useful.
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          ) : (
            <video className="gal__media" src={current.url} controls playsInline preload="metadata" />
          )
        ) : (
          <button
            type="button"
            className="gal__media gal__media--photo"
            onClick={() => setLightbox(true)}
            aria-label={current.alt_text ? `Enlarge: ${current.alt_text}` : 'Enlarge photo'}
          >
            <img src={current.url} alt={current.alt_text || ''} />
          </button>
        )}

        {count > 1 && (
          <>
            <button type="button" className="gal__arrow gal__arrow--prev"
              onClick={() => go(index - 1)} aria-label="Previous">
              <ChevronDownIcon size={20} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button type="button" className="gal__arrow gal__arrow--next"
              onClick={() => go(index + 1)} aria-label="Next">
              <ChevronDownIcon size={20} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="gal__thumbs" ref={stripRef} role="tablist" aria-label="Choose media">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`gal__thumb ${i === index ? 'gal__thumb--on' : ''}`}
              onClick={() => go(i)}
              aria-label={m.alt_text || (m.kind === 'youtube' ? 'Video' : `Photo ${i + 1}`)}
            >
              <img src={m.kind === 'youtube' ? m.thumbnail : m.url} alt="" loading="lazy" />
              {(m.kind === 'youtube' || m.kind === 'video') && (
                <span className="gal__thumb-play" aria-hidden="true">▶</span>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox && !isVideo && (
        <div className="gal__lightbox" onClick={() => setLightbox(false)} role="dialog" aria-modal="true"
             aria-label={current.alt_text || 'Photo viewer'}>
          <button className="gal__close" onClick={() => setLightbox(false)} aria-label="Close viewer">
            <XIcon size={20} />
          </button>
          <img src={current.url} alt={current.alt_text || ''} onClick={(e) => e.stopPropagation()} />
          <p className="gal__pos">{index + 1} of {count}</p>
        </div>
      )}
    </section>
  );
}
