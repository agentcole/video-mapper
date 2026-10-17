/*{
  "DESCRIPTION": "Repeat the image in a grid",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Tile",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "columns",
      "LABEL": "Columns",
      "TYPE": "float",
      "DEFAULT": 3,
      "MIN": 1,
      "MAX": 16
    },
    {
      "NAME": "rows",
      "LABEL": "Rows",
      "TYPE": "float",
      "DEFAULT": 3,
      "MIN": 1,
      "MAX": 16
    },
    {
      "NAME": "mirror",
      "LABEL": "Mirror tiles",
      "TYPE": "bool",
      "DEFAULT": true
    }
  ]
}*/

void main() {
  vec2 uv = isf_FragNormCoord * vec2(floor(columns), floor(rows));
  vec2 cell = floor(uv);
  uv = fract(uv);
  if (mirror) uv = mix(uv, 1.0 - uv, mod(cell, 2.0));
  gl_FragColor = IMG_NORM_PIXEL(inputImage, uv);
}
