/*{
  "DESCRIPTION": "Animated noise",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Film Grain",
  "CATEGORIES": [
    "Stylize"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "amount",
      "LABEL": "Amount",
      "TYPE": "float",
      "DEFAULT": 0.15,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "size",
      "LABEL": "Grain size (px)",
      "TYPE": "float",
      "DEFAULT": 1.5,
      "MIN": 1,
      "MAX": 8
    },
    {
      "NAME": "mono",
      "LABEL": "Monochrome",
      "TYPE": "bool",
      "DEFAULT": true
    }
  ]
}*/

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec2 cell = floor(gl_FragCoord.xy / size) + floor(TIME * 24.0) * 17.0;
  vec3 n = mono ? vec3(hash(cell)) : vec3(hash(cell), hash(cell + 3.1), hash(cell + 7.7));
  gl_FragColor = vec4(c.rgb + (n - 0.5) * amount, c.a);
}
