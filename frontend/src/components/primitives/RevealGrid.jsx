// components/primitives/RevealGrid.jsx
// A grid that pops its children in with a staggered spring reveal as it
// scrolls into view -- anime "cards land one after another" energy,
// instead of everything just appearing flat.
import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
};

export default function RevealGrid({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={child.key ?? i} variants={item}>
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  );
}
