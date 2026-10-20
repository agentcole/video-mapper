/*{
  "DESCRIPTION": "Spectrum analyser bars of the audio input (log frequency)",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Spectrum",
  "CATEGORIES": [
    "Audio"
  ],
  "INPUTS": [
    {
      "NAME": "fft",
      "TYPE": "audioFFT"
    },
    {
      "NAME": "bars",
      "LABEL": "Bars",
      "TYPE": "float",
      "DEFAULT": 48,
      "MIN": 4,
      "MAX": 128
    },
    {
      "NAME": "gap",
      "LABEL": "Gap",
      "TYPE": "float",
      "DEFAULT": 0.2,
      "MIN": 0,
      "MAX": 0.9
    },
    {
      "NAME": "gain",
      "LABEL": "Gain",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0.25,
      "MAX": 4
    },
    {
      "NAME": "low",
      "LABEL": "Low colour",
      "TYPE": "color",
      "DEFAULT": [0.0, 0.85, 1.0, 1.0]
    },
    {
      "NAME": "high",
      "LABEL": "High colour",
      "TYPE": "color",
      "DEFAULT": [1.0, 0.2, 0.6, 1.0]
    },
    {
      "NAME": "mirror",
      "LABEL": "Mirror",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

// 30 Hz … 16 kHz on a log scale; the FFT image covers 0 Hz … Nyquist (~24 kHz)
const float NYQUIST = 24000.0;

void main() {
  vec2 uv = isf_FragNormCoord;
  float n = floor(bars);
  float bar = floor(uv.x * n);
  float inBar = fract(uv.x * n);
  float hz = 30.0 * pow(16000.0 / 30.0, (bar + 0.5) / n);
  float level = clamp(IMG_NORM_PIXEL(fft, vec2(hz / NYQUIST, 0.5)).r * gain, 0.0, 1.0);
  float y = mirror ? abs(uv.y * 2.0 - 1.0) : uv.y;
  float lit = step(y, level) * step(gap * 0.5, inBar) * step(inBar, 1.0 - gap * 0.5);
  vec4 color = mix(low, high, y);
  gl_FragColor = vec4(color.rgb, color.a * lit);
}
