// components/primitives/RevealGrid.jsx
// A grid whose children arrive in sequence as it scrolls into view,
// giving the eye a reading direction instead of a wall of cards
// appearing at once.
import { motion, useReducedMotion } from 'framer-motion';

// 35ms apart, and only for the first six. Uncapped stagger on a
// twenty-event grid means the last card starts 700ms after the first,
// which stops reading as choreography and starts reading as lag --
// the page appears to be struggling rather than performing.
const STEP = 0.035;
const MAX_STAGGERED = 6;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: STEP } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    // Damping above the critical point: this settles without
    // overshoot. A card that bounces past its position reads as
    // unstable, and twelve of them bouncing reads as noise. The
    // overshoot curve is reserved for discrete controls, where the
    // bounce is the feedback.
    transition: { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 },
  },
};

// Items past the cap skip the travel and fade only, so a long grid
// finishes arriving in roughly a fifth of a second regardless of length.
const tail = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
};

export default function RevealGrid({ children, className = '' }) {
  const reduced = useReducedMotion();
  const items = Array.isArray(children) ? children : null;

  // Respecting the OS setting is not a nicety here: staggered motion
  // across a full grid is exactly the kind of thing that triggers
  // vestibular symptoms.
  if (reduced || !items) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      {items.map((child, i) => (
        <motion.div key={child?.key ?? i} variants={i < MAX_STAGGERED ? item : tail}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
