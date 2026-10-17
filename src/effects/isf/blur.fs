/*{
  "DESCRIPTION": "Gaussian blur (two passes)",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Blur",
  "CATEGORIES": [
    "Blur"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "radius",
      "LABEL": "Radius (px)",
      "TYPE": "float",
      "DEFAULT": 8,
      "MIN": 0,
      "MAX": 48
    }
  ],
  "PASSES": [
    {
      "TARGET": "horizontal"
    },
    {}
  ]
}*/

vec4 blur(vec2 dir) {
  if (radius <= 0.0) return IMG_THIS_PIXEL(inputImage);
  float sigma = radius / 2.0;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * radius / 12.0;
    float w = exp(-(x * x) / (2.0 * sigma * sigma));
    vec2 uv = isf_FragNormCoord + dir * x / RENDERSIZE;
    sum += (PASSINDEX == 0 ? IMG_NORM_PIXEL(inputImage, uv) : IMG_NORM_PIXEL(horizontal, uv)) * w;
    total += w;
  }
  return sum / total;
}
void main() {
  gl_FragColor = PASSINDEX == 0 ? blur(vec2(1.0, 0.0)) : blur(vec2(0.0, 1.0));
}
