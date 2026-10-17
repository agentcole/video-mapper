/*{
  "DESCRIPTION": "Outlines (Sobel)",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Edge Detect",
  "CATEGORIES": [
    "Stylize"
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
      "DEFAULT": 2,
      "MIN": 0,
      "MAX": 8
    },
    {
      "NAME": "mode",
      "LABEL": "Mode",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2
      ],
      "LABELS": [
        "Glowing edges",
        "Edges on black",
        "Ink on white"
      ],
      "DEFAULT": 0
    }
  ]
}*/

float lum(vec2 o) { return dot(IMG_NORM_PIXEL(inputImage, isf_FragNormCoord + o / RENDERSIZE).rgb, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  float gx = -lum(vec2(-1.0, 1.0)) - 2.0 * lum(vec2(-1.0, 0.0)) - lum(vec2(-1.0, -1.0)) + lum(vec2(1.0, 1.0)) + 2.0 * lum(vec2(1.0, 0.0)) + lum(vec2(1.0, -1.0));
  float gy = -lum(vec2(-1.0, -1.0)) - 2.0 * lum(vec2(0.0, -1.0)) - lum(vec2(1.0, -1.0)) + lum(vec2(-1.0, 1.0)) + 2.0 * lum(vec2(0.0, 1.0)) + lum(vec2(1.0, 1.0));
  float e = clamp(length(vec2(gx, gy)) * strength, 0.0, 1.0);
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec3 rgb = mode == 0 ? c.rgb * e * 2.0 : mode == 1 ? vec3(e) : vec3(1.0 - e);
  gl_FragColor = vec4(rgb, c.a);
}
