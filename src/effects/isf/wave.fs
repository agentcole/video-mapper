/*{
  "DESCRIPTION": "Sine-wave displacement",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Wave",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "amplitude",
      "LABEL": "Amplitude",
      "TYPE": "float",
      "DEFAULT": 0.02,
      "MIN": 0,
      "MAX": 0.2
    },
    {
      "NAME": "frequency",
      "LABEL": "Frequency",
      "TYPE": "float",
      "DEFAULT": 8,
      "MIN": 0,
      "MAX": 64
    },
    {
      "NAME": "speed",
      "LABEL": "Speed",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": -10,
      "MAX": 10
    },
    {
      "NAME": "direction",
      "LABEL": "Direction",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2
      ],
      "LABELS": [
        "Horizontal",
        "Vertical",
        "Both"
      ],
      "DEFAULT": 0
    }
  ]
}*/

void main() {
  vec2 uv = isf_FragNormCoord;
  float t = TIME * speed;
  if (direction != 1) uv.x += sin(uv.y * frequency * 6.2831853 + t) * amplitude;
  if (direction != 0) uv.y += sin(uv.x * frequency * 6.2831853 + t) * amplitude;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(uv, 0.0, 1.0));
}
