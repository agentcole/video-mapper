/*{
  "DESCRIPTION": "Bright parts bleed light",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Glow",
  "CATEGORIES": [
    "Stylize"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "threshold",
      "LABEL": "Threshold",
      "TYPE": "float",
      "DEFAULT": 0.6,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "intensity",
      "LABEL": "Intensity",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0,
      "MAX": 4
    },
    {
      "NAME": "radius",
      "LABEL": "Radius (px)",
      "TYPE": "float",
      "DEFAULT": 12,
      "MIN": 1,
      "MAX": 48
    }
  ]
}*/

vec3 bright(vec2 uv) {
  vec3 c = IMG_NORM_PIXEL(inputImage, uv).rgb;
  return max(c - threshold, 0.0) / max(1.0 - threshold, 0.001);
}
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int ring = 1; ring <= 3; ring++) {
    float r = radius * float(ring) / 3.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398 + float(ring) * 0.3;
      float w = 1.0 / float(ring);
      sum += bright(isf_FragNormCoord + vec2(cos(a), sin(a)) * r / RENDERSIZE) * w;
      total += w;
    }
  }
  gl_FragColor = vec4(c.rgb + sum / total * intensity, c.a);
}
