/*{
  "DESCRIPTION": "Colourise towards one colour",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Tint",
  "CATEGORIES": [
    "Color"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "color",
      "LABEL": "Color",
      "TYPE": "color",
      "DEFAULT": [
        1,
        0.4,
        0,
        1
      ]
    },
    {
      "NAME": "amount",
      "LABEL": "Amount",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 1
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(mix(c.rgb, luma * color.rgb * 1.5, amount), c.a);
}
