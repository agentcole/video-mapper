// The calibration test card (same design as components/TestCard.tsx) drawn
// into a 2D canvas, for use as a GPU texture.

const MAX_SIDE = 4096;

/** `resolution`: canvas px per test-card unit (e.g. output pixel density × zoom). */
export function drawTestCard(width: number, height: number, label?: string, resolution = 1): HTMLCanvasElement {
  const scale = Math.min(resolution, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const cell = Math.max(16, Math.round(Math.max(width, height) / 16));
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 4;
  // Monospace glyphs are about 0.6 em wide: the label fits in 90 % of the width
  const fontSize = Math.max(12, Math.min(Math.min(width, height) / 12, (0.9 * width) / (0.6 * Math.max(1, label?.length ?? 0))));

  // Checkerboard
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#374151';
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) ctx.fillRect(x, y, cell, cell);
    }
  }

  const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const circle = (radius: number, w: number, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Diagonals
  line(0, 0, width, height, '#22d3ee', 2, 0.6);
  line(width, 0, 0, height, '#22d3ee', 2, 0.6);

  // Border
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Centre circle + crosshair
  circle(r, 3);
  circle(r / 2, 2, 0.6);
  line(cx - r * 1.3, cy, cx + r * 1.3, cy, '#ffffff', 2);
  line(cx, cy - r * 1.3, cx, cy + r * 1.3, '#ffffff', 2);

  if (label) {
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = fontSize / 6;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, cx, cy - r * 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, cy - r * 1.5);
  }
  return canvas;
}
