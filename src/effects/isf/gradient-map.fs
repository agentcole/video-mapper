/*{
  "DESCRIPTION": "Map brightness to a three-colour gradient",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Gradient Map",
  "CATEGORIES": [
    "Color"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "shadows",
      "LABEL": "Shadows",
      "TYPE": "color",
      "DEFAULT": [
        0.05,
        0.0,
        0.2,
        1
      ]
    },
    {
      "NAME": "midtones",
      "LABEL": "Midtones",
      "TYPE": "color",
      "DEFAULT": [
        0.9,
        0.1,
        0.4,
        1
      ]
    },
    {
      "NAME": "highlights",
      "LABEL": "Highlights",
      "TYPE": "color",
      "DEFAULT": [
        1,
        0.9,
        0.5,
        1
      ]
    },
    {
      "NAME": "amount",
      "LABEL": "Amount",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0,
      "MAX": 1
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 g = luma < 0.5 ? mix(shadows.rgb, midtones.rgb, luma * 2.0) : mix(midtones.rgb, highlights.rgb, luma * 2.0 - 1.0);
  gl_FragColor = vec4(mix(c.rgb, g, amount), c.a);
}
