/*{
  "DESCRIPTION": "Rings expanding from a centre",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Rings",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "count",
      "LABEL": "Rings",
      "TYPE": "float",
      "DEFAULT": 6,
      "MIN": 1,
      "MAX": 32
    },
    {
      "NAME": "thickness",
      "LABEL": "Thickness",
      "TYPE": "float",
      "DEFAULT": 0.3,
      "MIN": 0.02,
      "MAX": 0.9
    },
    {
      "NAME": "speed",
      "LABEL": "Speed",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": -4,
      "MAX": 4
    },
    {
      "NAME": "beat",
      "LABEL": "Pulse on the beat",
      "TYPE": "bool",
      "DEFAULT": true
    },
    {
      "NAME": "colorA",
      "LABEL": "Ring",
      "TYPE": "color",
      "DEFAULT": [
        0.2,
        1,
        0.9,
        1
      ]
    },
    {
      "NAME": "colorB",
      "LABEL": "Background",
      "TYPE": "color",
      "DEFAULT": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "NAME": "center",
      "LABEL": "Centre",
      "TYPE": "point2D",
      "DEFAULT": [
        0.5,
        0.5
      ],
      "MIN": [
        0,
        0
      ],
      "MAX": [
        1,
        1
      ]
    }
  ]
}*/

void main() {
  vec2 d = (isf_FragNormCoord - center) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  float t = beat ? BEAT : TIME * speed;
  float x = fract(length(d) * floor(count) - t);
  float k = smoothstep(0.0, 0.02, x) * (1.0 - smoothstep(thickness, thickness + 0.02, x));
  gl_FragColor = mix(colorB, colorA, k);
}
