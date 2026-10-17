/*{
  "DESCRIPTION": "Printed dots",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Halftone",
  "CATEGORIES": [
    "Stylize"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "size",
      "LABEL": "Dot spacing (px)",
      "TYPE": "float",
      "DEFAULT": 10,
      "MIN": 3,
      "MAX": 64
    },
    {
      "NAME": "angle",
      "LABEL": "Angle",
      "TYPE": "float",
      "DEFAULT": 0.125,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "color",
      "LABEL": "Colour dots",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  float a = angle * 6.2831853;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 p = rot * gl_FragCoord.xy / size;
  vec2 cellCentre = (transpose(rot) * ((floor(p) + 0.5) * size)) / RENDERSIZE;
  vec4 c = IMG_NORM_PIXEL(inputImage, clamp(cellCentre, 0.0, 1.0));
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float r = length(fract(p) - 0.5);
  float dotMask = 1.0 - smoothstep(0.0, 0.08, r - sqrt(color ? 1.0 : luma) * 0.55);
  vec3 ink = color ? c.rgb : vec3(1.0);
  gl_FragColor = vec4(ink * dotMask, c.a);
}
