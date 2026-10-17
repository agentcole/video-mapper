/*{
  "DESCRIPTION": "Crisper detail",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Sharpen",
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
      "DEFAULT": 1,
      "MIN": 0,
      "MAX": 4
    }
  ]
}*/

void main() {
  vec2 px = 1.0 / RENDERSIZE;
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec4 n = IMG_NORM_PIXEL(inputImage, isf_FragNormCoord + vec2(0.0, px.y))
         + IMG_NORM_PIXEL(inputImage, isf_FragNormCoord - vec2(0.0, px.y))
         + IMG_NORM_PIXEL(inputImage, isf_FragNormCoord + vec2(px.x, 0.0))
         + IMG_NORM_PIXEL(inputImage, isf_FragNormCoord - vec2(px.x, 0.0));
  gl_FragColor = vec4(clamp(c.rgb + (4.0 * c.rgb - n.rgb) * amount, 0.0, 1.0), c.a);
}
