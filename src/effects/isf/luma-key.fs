/*{
  "DESCRIPTION": "Make dark (or bright) parts transparent",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Luma Key",
  "CATEGORIES": [
    "Key"
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
      "DEFAULT": 0.2,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "softness",
      "LABEL": "Softness",
      "TYPE": "float",
      "DEFAULT": 0.1,
      "MIN": 0,
      "MAX": 0.5
    },
    {
      "NAME": "invert",
      "LABEL": "Key out bright",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float a = smoothstep(threshold, threshold + softness + 0.0001, luma);
  if (invert) a = 1.0 - a;
  gl_FragColor = vec4(c.rgb, c.a * a);
}
