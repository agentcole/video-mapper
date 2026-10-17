/*{
  "DESCRIPTION": "Moving bars",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Stripes",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "count",
      "LABEL": "Stripes",
      "TYPE": "float",
      "DEFAULT": 10,
      "MIN": 1,
      "MAX": 64
    },
    {
      "NAME": "angle",
      "LABEL": "Angle",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 1
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
      "NAME": "softness",
      "LABEL": "Softness",
      "TYPE": "float",
      "DEFAULT": 0.05,
      "MIN": 0,
      "MAX": 0.5
    },
    {
      "NAME": "colorA",
      "LABEL": "Colour A",
      "TYPE": "color",
      "DEFAULT": [
        1,
        1,
        1,
        1
      ]
    },
    {
      "NAME": "colorB",
      "LABEL": "Colour B",
      "TYPE": "color",
      "DEFAULT": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "NAME": "beat",
      "LABEL": "Step on the beat",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  float a = angle * 6.2831853;
  vec2 p = (isf_FragNormCoord - 0.5) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  float t = beat ? floor(BEAT) * 0.5 / floor(count) : TIME * speed * 0.1;
  float x = fract((p.x * cos(a) + p.y * sin(a)) * floor(count) + t * floor(count));
  float k = smoothstep(0.5 - softness, 0.5 + softness, x) - smoothstep(1.0 - softness, 1.0, x);
  gl_FragColor = mix(colorB, colorA, k);
}
