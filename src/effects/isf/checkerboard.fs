/*{
  "DESCRIPTION": "Squares, optionally scrolling",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Checkerboard",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "cells",
      "LABEL": "Cells across",
      "TYPE": "float",
      "DEFAULT": 8,
      "MIN": 1,
      "MAX": 64
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
      "NAME": "speed",
      "LABEL": "Scroll",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -2,
      "MAX": 2
    }
  ]
}*/

void main() {
  vec2 p = gl_FragCoord.xy / (RENDERSIZE.x / floor(cells)) + vec2(TIME * speed, 0.0);
  float k = mod(floor(p.x) + floor(p.y), 2.0);
  gl_FragColor = mix(colorA, colorB, k);
}
