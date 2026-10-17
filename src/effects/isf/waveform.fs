/*{
  "DESCRIPTION": "Oscilloscope line of the audio input",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Waveform",
  "CATEGORIES": [
    "Audio"
  ],
  "INPUTS": [
    {
      "NAME": "wave",
      "TYPE": "audio"
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
      "NAME": "thickness",
      "LABEL": "Thickness",
      "TYPE": "float",
      "DEFAULT": 0.01,
      "MIN": 0.002,
      "MAX": 0.08
    },
    {
      "NAME": "glow",
      "LABEL": "Glow",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "color",
      "LABEL": "Colour",
      "TYPE": "color",
      "DEFAULT": [0.3, 1.0, 0.7, 1.0]
    }
  ]
}*/

float waveY(float x) {
  return 0.5 + (IMG_NORM_PIXEL(wave, vec2(clamp(x, 0.0, 1.0), 0.5)).r - 0.5) * gain;
}

void main() {
  vec2 uv = isf_FragNormCoord;
  // The line from the previous to the next sample: steep edges stay connected
  float dx = 1.0 / IMG_SIZE(wave).x;
  float y = waveY(uv.x);
  float a = mix(y, waveY(uv.x - dx), 0.5);
  float b = mix(y, waveY(uv.x + dx), 0.5);
  float lo = min(y, min(a, b));
  float hi = max(y, max(a, b));
  float d = uv.y < lo ? lo - uv.y : uv.y > hi ? uv.y - hi : 0.0;
  float line = 1.0 - smoothstep(thickness * 0.4, thickness, d);
  float halo = glow * exp(-d / (thickness * 6.0)) * 0.6;
  float k = clamp(line + halo, 0.0, 1.0);
  gl_FragColor = vec4(color.rgb, color.a * k);
}
