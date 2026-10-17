/*{
  "DESCRIPTION": "Hexagonal cells",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Hex Pixelate",
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
      "DEFAULT": 24,
      "MIN": 4,
      "MAX": 128
    }
  ]
}*/

vec2 hexCentre(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  return dot(a, a) < dot(b, b) ? p - a : p - b;
}
void main() {
  vec2 p = gl_FragCoord.xy / size;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(hexCentre(p) * size / RENDERSIZE, 0.0, 1.0));
}
