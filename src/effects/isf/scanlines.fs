/*{
  "DESCRIPTION": "CRT-style lines",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Scanlines",
  "CATEGORIES": [
    "Stylize"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "lines",
      "LABEL": "Lines",
      "TYPE": "float",
      "DEFAULT": 240,
      "MIN": 20,
      "MAX": 1080
    },
    {
      "NAME": "intensity",
      "LABEL": "Intensity",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "speed",
      "LABEL": "Roll speed",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -2,
      "MAX": 2
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float s = 0.5 + 0.5 * sin((isf_FragNormCoord.y + TIME * speed * 0.1) * lines * 6.2831853);
  gl_FragColor = vec4(c.rgb * (1.0 - intensity * s), c.a);
}
