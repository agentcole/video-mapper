/*{
  "DESCRIPTION": "Two colours split by brightness",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Threshold",
  "CATEGORIES": [
    "Color"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "level",
      "LABEL": "Level",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "softness",
      "LABEL": "Softness",
      "TYPE": "float",
      "DEFAULT": 0.02,
      "MIN": 0,
      "MAX": 0.5
    },
    {
      "NAME": "dark",
      "LABEL": "Dark",
      "TYPE": "color",
      "DEFAULT": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "NAME": "light",
      "LABEL": "Light",
      "TYPE": "color",
      "DEFAULT": [
        1,
        1,
        1,
        1
      ]
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float t = smoothstep(level - softness, level + softness + 0.0001, luma);
  vec4 o = mix(dark, light, t);
  gl_FragColor = vec4(o.rgb, o.a * c.a);
}
