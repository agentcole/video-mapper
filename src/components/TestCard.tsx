import React, { useId } from 'react';

interface TestCardProps {
  width: number; // logical size (viewBox), matches the surface it calibrates
  height: number;
  label?: string;
}

/**
 * Projection calibration test card: checkerboard, border, diagonals,
 * center circle + crosshair and a label. Used per-frame (warps with the
 * frame's corner pin) and as the global output test pattern.
 */
export const TestCard: React.FC<TestCardProps> = ({ width, height, label }) => {
  const patternId = useId();
  const cell = Math.max(16, Math.round(Math.max(width, height) / 16));
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 4;
  // Monospace glyphs are about 0.6 em wide: the label fits in 90 % of the width
  const fontSize = Math.max(12, Math.min(Math.min(width, height) / 12, (0.9 * width) / (0.6 * Math.max(1, label?.length ?? 0))));

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id={patternId} width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
          <rect width={cell * 2} height={cell * 2} fill="#1f2937" />
          <rect width={cell} height={cell} fill="#374151" />
          <rect x={cell} y={cell} width={cell} height={cell} fill="#374151" />
        </pattern>
      </defs>

      {/* Checkerboard */}
      <rect width={width} height={height} fill={`url(#${patternId})`} />

      {/* Diagonals */}
      <line x1={0} y1={0} x2={width} y2={height} stroke="#22d3ee" strokeWidth={2} opacity={0.6} />
      <line x1={width} y1={0} x2={0} y2={height} stroke="#22d3ee" strokeWidth={2} opacity={0.6} />

      {/* Border */}
      <rect x={2} y={2} width={width - 4} height={height - 4} fill="none" stroke="#f97316" strokeWidth={4} />

      {/* Center circle + crosshair */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={r / 2} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.6} />
      <line x1={cx - r * 1.3} y1={cy} x2={cx + r * 1.3} y2={cy} stroke="#ffffff" strokeWidth={2} />
      <line x1={cx} y1={cy - r * 1.3} x2={cx} y2={cy + r * 1.3} stroke="#ffffff" strokeWidth={2} />

      {/* Label */}
      {label && (
        <text
          x={cx}
          y={cy - r * 1.5}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={fontSize}
          fontFamily="monospace"
          fontWeight="bold"
          stroke="#000000"
          strokeWidth={fontSize / 12}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </svg>
  );
};
