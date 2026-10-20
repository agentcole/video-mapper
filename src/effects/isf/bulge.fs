/*{
  "DESCRIPTION": "Fisheye bulge or pinch",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Bulge",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "strength",
      "LABEL": "Strength",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": -1,
      "MAX": 1
    },
    {
      "NAME": "radius",
      "LABEL": "Radius",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0.05,
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
  float r = length(d) / radius;
  if (r < 1.0) d *= mix(1.0, smoothstep(0.0, 1.0, r), strength);
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(center + d / aspect, 0.0, 1.0));
}
