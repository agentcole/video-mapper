/*{
  "DESCRIPTION": "Mirror one half (or quarter) onto the other",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Mirror",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "mode",
      "LABEL": "Mode",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3,
        4
      ],
      "LABELS": [
        "Left \u2192 right",
        "Right \u2192 left",
        "Top \u2192 bottom",
        "Bottom \u2192 top",
        "Quad"
      ],
      "DEFAULT": 0
    }
  ]
}*/

void main() {
  vec2 uv = isf_FragNormCoord;
  if (mode == 0 || mode == 4) uv.x = uv.x > 0.5 ? 1.0 - uv.x : uv.x;
  if (mode == 1) uv.x = uv.x < 0.5 ? 1.0 - uv.x : uv.x;
  if (mode == 2 || mode == 4) uv.y = uv.y < 0.5 ? 1.0 - uv.y : uv.y;
  if (mode == 3) uv.y = uv.y > 0.5 ? 1.0 - uv.y : uv.y;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, uv);
}
