/*{
  "DESCRIPTION": "Big square pixels",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Pixelate",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "size",
      "LABEL": "Cell size (px)",
      "TYPE": "float",
      "DEFAULT": 16,
      "MIN": 1,
      "MAX": 128
    }
  ]
}*/

void main() {
  vec2 cell = vec2(max(1.0, size));
  vec2 px = (floor(gl_FragCoord.xy / cell) + 0.5) * cell;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, px / RENDERSIZE);
}
