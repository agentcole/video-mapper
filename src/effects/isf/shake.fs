/*{
  "DESCRIPTION": "Jolt the image on every beat",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Shake",
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
      "LABEL": "Amount (px)",
      "TYPE": "float",
      "DEFAULT": 20,
      "MIN": 0,
      "MAX": 120
    },
    {
      "NAME": "decay",
      "LABEL": "Decay",
      "TYPE": "float",
      "DEFAULT": 8,
      "MIN": 1,
      "MAX": 30
    }
  ]
}*/

float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float beat = floor(BEAT);
  float k = exp(-decay * fract(BEAT));
  vec2 jolt = (vec2(hash(beat), hash(beat + 9.1)) - 0.5) * 2.0 * amount * k;
  gl_FragColor = IMG_NORM_PIXEL(inputImage, clamp(isf_FragNormCoord + jolt / RENDERSIZE, 0.0, 1.0));
}
