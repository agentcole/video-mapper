// ---------------------------------------------------------------------------
// What machine and browser the benchmark ran on — results only make sense
// next to this.
// ---------------------------------------------------------------------------

export interface CodecSupport {
  name: string;
  supported: boolean;
  smooth: boolean;
  powerEfficient: boolean; // usually means hardware decoding
}

export interface EnvironmentInfo {
  userAgent: string;
  cores: number | null;
  memoryGB: number | null;
  gpu: string | null;
  screen: string;
  devicePixelRatio: number;
  codecs: CodecSupport[];
}

const CODECS_1080P: { name: string; contentType: string }[] = [
  { name: 'H.264', contentType: 'video/mp4; codecs="avc1.640028"' },
  { name: 'HEVC', contentType: 'video/mp4; codecs="hvc1.1.6.L120.90"' },
  { name: 'VP9', contentType: 'video/webm; codecs="vp09.00.40.08"' },
  { name: 'AV1', contentType: 'video/mp4; codecs="av01.0.08M.08"' },
];

const gpuName = (): string | null => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch {
    return null;
  }
};

const codecSupport = async (): Promise<CodecSupport[]> => {
  if (!navigator.mediaCapabilities) return [];
  return Promise.all(CODECS_1080P.map(async ({ name, contentType }) => {
    try {
      const info = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: { contentType, width: 1920, height: 1080, bitrate: 10_000_000, framerate: 30 },
      });
      return { name, supported: info.supported, smooth: info.smooth, powerEfficient: info.powerEfficient };
    } catch {
      return { name, supported: false, smooth: false, powerEfficient: false };
    }
  }));
};

export async function getEnvironmentInfo(): Promise<EnvironmentInfo> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    cores: navigator.hardwareConcurrency ?? null,
    memoryGB: nav.deviceMemory ?? null,
    gpu: gpuName(),
    screen: `${screen.width}×${screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    codecs: await codecSupport(),
  };
}
