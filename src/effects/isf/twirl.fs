/*{
  "DESCRIPTION": "Swirl around a centre",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Twirl",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "angle",
      "LABEL": "Angle",
      "TYPE": "float",
      "DEFAULT": 2,
      "MIN": -12,
      "MAX": 12
    },
    {
      "NAME": "radius",
      "LABEL": "Radius",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0.01,
      "MAX": 1.5
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
  float k = max(0.0, 1.0 - r / radius);
  float a = angle * k * k;
  vec2 rd = vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(center + rd / aspect, 0.0, 1.0));
}
