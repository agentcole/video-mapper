// ---------------------------------------------------------------------------
// Synthetic test clip: an animated canvas recorded with MediaRecorder.
// Busy, moving content so the encoder can't cheat with static frames.
// The codec is whatever the browser records (VP9/VP8 WebM or H.264 MP4) —
// for show decisions, also benchmark real show files.
// ---------------------------------------------------------------------------

export interface TestClip {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  fps: number;
}

const PREFERRED_TYPES = [
  'video/mp4;codecs=avc1.640028',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export const pickRecorderType = (): string | undefined =>
  typeof MediaRecorder === 'undefined'
    ? undefined
    : PREFERRED_TYPES.find(type => MediaRecorder.isTypeSupported(type));

export async function generateTestClip(
  width: number,
  height: number,
  seconds = 4,
  fps = 30,
  onProgress?: (fraction: number) => void
): Promise<TestClip> {
  const mimeType = pickRecorderType();
  if (!mimeType) throw new Error('This browser cannot record video (MediaRecorder unsupported).');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.round((width * height * fps) / 6), // ~10 Mbit/s at 1080p30
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>(resolve => {
    recorder.onstop = () => resolve();
  });

  const draw = (t: number) => {
    const phase = t / 1000;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${(phase * 60) % 360}, 70%, 35%)`);
    gradient.addColorStop(1, `hsl(${(phase * 60 + 180) % 360}, 70%, 25%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    // Moving blocks across the whole frame
    for (let i = 0; i < 48; i++) {
      const x = ((i * 397 + phase * (80 + i * 13)) % (width + 200)) - 100;
      const y = ((i * 211 + phase * (40 + i * 7)) % (height + 200)) - 100;
      ctx.fillStyle = `hsla(${(i * 37 + phase * 90) % 360}, 80%, 60%, 0.8)`;
      ctx.fillRect(x, y, width / 16, height / 9);
    }
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.round(height / 8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phase.toFixed(2), width / 2, height / 2);
  };

  recorder.start(250);
  const start = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      const elapsed = performance.now() - start;
      draw(elapsed);
      onProgress?.(Math.min(1, elapsed / (seconds * 1000)));
      if (elapsed >= seconds * 1000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach(track => track.stop());

  return { blob: new Blob(chunks, { type: mimeType.split(';')[0] }), mimeType, width, height, fps };
}
