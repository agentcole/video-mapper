/*{
  "DESCRIPTION": "Shift the colour channels apart",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "RGB Split",
  "CATEGORIES": [
    "Distort"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "amount",
      "LABEL": "Amount (px)",
      "TYPE": "float",
      "DEFAULT": 8,
      "MIN": 0,
      "MAX": 64
    },
    {
      "NAME": "angle",
      "LABEL": "Angle",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "pulse",
      "LABEL": "Pulse on the beat",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  float k = pulse ? exp(-4.0 * fract(BEAT)) : 1.0;
  vec2 d = vec2(cos(angle * 6.2831853), sin(angle * 6.2831853)) * amount * k / RENDERSIZE;
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float r = IMG_NORM_PIXEL(inputImage, isf_FragNormCoord + d).r;
  float b = IMG_NORM_PIXEL(inputImage, isf_FragNormCoord - d).b;
  gl_FragColor = vec4(r, c.g, b, c.a);
}
