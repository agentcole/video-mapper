/*{
  "DESCRIPTION": "Zoom, rotate and move, with tiling",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Transform",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "zoom",
      "LABEL": "Zoom",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0.1,
      "MAX": 8
    },
    {
      "NAME": "rotation",
      "LABEL": "Rotation",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -1,
      "MAX": 1
    },
    {
      "NAME": "spin",
      "LABEL": "Spin (turns/s)",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -2,
      "MAX": 2
    },
    {
      "NAME": "offset",
      "LABEL": "Offset",
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
      "NAME": "edges",
      "LABEL": "Edges",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3
      ],
      "LABELS": [
        "Repeat",
        "Mirror",
        "Clamp",
        "Transparent"
      ],
      "DEFAULT": 1
    }
  ]
}*/

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  vec2 d = (isf_FragNormCoord - 0.5) * aspect / zoom;
  float a = -6.2831853 * (rotation + spin * TIME);
  d = vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  vec2 uv = d / aspect + 0.5 - (offset - 0.5);
  if (edges == 3 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
    gl_FragColor = vec4(0.0);
    return;
  }
  if (edges == 0) uv = fract(uv);
  if (edges == 1) uv = abs(mod(uv + 1.0, 2.0) - 1.0);
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(uv, 0.0, 1.0));
}
