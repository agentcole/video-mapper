/*{
  "DESCRIPTION": "Mirrored wedges around a centre",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Kaleidoscope",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "segments",
      "LABEL": "Segments",
      "TYPE": "float",
      "DEFAULT": 6,
      "MIN": 2,
      "MAX": 24
    },
    {
      "NAME": "rotation",
      "LABEL": "Rotation",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "speed",
      "LABEL": "Spin (turns/s)",
      "TYPE": "float",
      "DEFAULT": 0.05,
      "MIN": -1,
      "MAX": 1
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
  vec2 aspect = vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  vec2 d = (isf_FragNormCoord - center) * aspect;
  float r = length(d);
  float a = atan(d.y, d.x) + 6.2831853 * (rotation + speed * TIME);
  float wedge = 6.2831853 / floor(segments);
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5);
  vec2 uv = center + vec2(cos(a), sin(a)) * r / aspect;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, abs(mod(uv + 1.0, 2.0) - 1.0));
}
