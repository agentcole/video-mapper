/*{
  "DESCRIPTION": "Darken (or colour) the edges",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Vignette",
  "CATEGORIES": [
    "Stylize"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "radius",
      "LABEL": "Radius",
      "TYPE": "float",
      "DEFAULT": 0.75,
      "MIN": 0,
      "MAX": 1.5
    },
    {
      "NAME": "softness",
      "LABEL": "Softness",
      "TYPE": "float",
      "DEFAULT": 0.45,
      "MIN": 0.01,
      "MAX": 1
    },
    {
      "NAME": "color",
      "LABEL": "Colour",
      "TYPE": "color",
      "DEFAULT": [
        0,
        0,
        0,
        1
      ]
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec2 d = (isf_FragNormCoord - 0.5) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  float v = smoothstep(radius, radius - softness, length(d));
  gl_FragColor = vec4(mix(color.rgb, c.rgb, v), c.a);
}
