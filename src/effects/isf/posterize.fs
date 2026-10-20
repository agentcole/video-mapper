/*{
  "DESCRIPTION": "Reduce the number of colour levels",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Posterize",
  "CATEGORIES": [
    "Color"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "levels",
      "LABEL": "Levels",
      "TYPE": "float",
      "DEFAULT": 4,
      "MIN": 2,
      "MAX": 16
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float n = floor(levels);
  gl_FragColor = vec4(floor(c.rgb * n + 0.5) / n, c.a);
}
