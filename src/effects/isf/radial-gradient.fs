/*{
  "DESCRIPTION": "Glow from a centre",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Radial Gradient",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "inner",
      "LABEL": "Inner",
      "TYPE": "color",
      "DEFAULT": [
        1,
        0.9,
        0.6,
        1
      ]
    },
    {
      "NAME": "outer",
      "LABEL": "Outer",
      "TYPE": "color",
      "DEFAULT": [
        0.05,
        0,
        0.15,
        1
      ]
    },
    {
      "NAME": "radius",
      "LABEL": "Radius",
      "TYPE": "float",
      "DEFAULT": 0.6,
      "MIN": 0.05,
      "MAX": 2
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
    },
    {
      "NAME": "pulse",
      "LABEL": "Beat pulse",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 0.5
    }
  ]
}*/

void main() {
  vec2 d = (isf_FragNormCoord - center) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  float r = radius * (1.0 + pulse * exp(-5.0 * fract(BEAT)));
  gl_FragColor = mix(inner, outer, clamp(length(d) / r, 0.0, 1.0));
}
