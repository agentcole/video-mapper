/*{
  "DESCRIPTION": "Drifting value noise (fbm)",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Noise",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "scale",
      "LABEL": "Scale",
      "TYPE": "float",
      "DEFAULT": 4,
      "MIN": 0.5,
      "MAX": 32
    },
    {
      "NAME": "speed",
      "LABEL": "Speed",
      "TYPE": "float",
      "DEFAULT": 0.3,
      "MIN": 0,
      "MAX": 4
    },
    {
      "NAME": "dark",
      "LABEL": "Dark",
      "TYPE": "color",
      "DEFAULT": [
        0,
        0.02,
        0.1,
        1
      ]
    },
    {
      "NAME": "light",
      "LABEL": "Light",
      "TYPE": "color",
      "DEFAULT": [
        0.4,
        0.9,
        1,
        1
      ]
    },
    {
      "NAME": "contrast",
      "LABEL": "Contrast",
      "TYPE": "float",
      "DEFAULT": 1.2,
      "MIN": 0.2,
      "MAX": 4
    }
  ]
}*/

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = isf_FragNormCoord * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0) * scale + TIME * speed;
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += noise(p) * amp;
    p = p * 2.03 + 7.1;
    amp *= 0.5;
  }
  v = clamp((v - 0.5) * contrast + 0.5, 0.0, 1.0);
  gl_FragColor = mix(dark, light, v);
}
