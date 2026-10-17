/*{
  "DESCRIPTION": "Punch in on every beat",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Beat Zoom",
  "CATEGORIES": [
    "Beat"
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
      "NAME": "decay",
      "LABEL": "Decay",
      "TYPE": "float",
      "DEFAULT": 6,
      "MIN": 1,
      "MAX": 20
    }
  ]
}*/

void main() {
  float k = 1.0 + amount * exp(-decay * fract(BEAT));
  vec2 uv = (isf_FragNormCoord - 0.5) / k + 0.5;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, uv);
}
