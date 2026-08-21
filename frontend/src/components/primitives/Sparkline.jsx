// components/primitives/Sparkline.jsx
//
// A trend line for a KPI card. Deliberately small in scope: no axes, no
// grid, no tooltip. A sparkline answers one question -- which way has
// this been going -- and anything else on it competes with the number
// it sits under.
//
// It renders nothing at all when there is no series, rather than
// drawing a flat line. A flat line is a claim that the metric did not
// move, which is a different statement from not knowing.
import { useId } from 'react';
import './sparkline.css';

export default function Sparkline({
  data = [],
  width = 132,
  height = 34,
  stroke = 'currentColor',
  label,
}) {
  const gradientId = useId();
  const points = Array.isArray(data) ? data.filter((n) => Number.isFinite(n)) : [];
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  // A series that never changes has no meaningful vertical scale, so it
  // is drawn down the middle instead of dividing by a zero range.
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (points.length - 1);
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const coords = points.map((v, i) => [pad + i * stepX, y(v)]);
  const line = coords.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  const first = points[0];
  const last = points[points.length - 1];
  const direction = last > first ? 'up' : last < first ? 'down' : 'level';

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        label
          ? `${label}: trending ${direction}, ${points.length} day series`
          : `Trending ${direction} over ${points.length} days`
      }
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        className="spark__line"
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The head of the line is the only point worth marking: it is
          where the metric stands now. */}
      <circle cx={lastX} cy={lastY} r="2.6" fill={stroke} />
    </svg>
  );
}
