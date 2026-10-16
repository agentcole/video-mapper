/*{
  "DESCRIPTION": "Classic flowing plasma",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Plasma",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "scale",
      "LABEL": "Scale",
      "TYPE": "float",
      "DEFAULT": 3,
      "MIN": 0.5,
      "MAX": 12
    },
    {
      "NAME": "speed",
      "LABEL": "Speed",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 4
    },
    {
      "NAME": "colorA",
      "LABEL": "Colour A",
      "TYPE": "color",
      "DEFAULT": [
        0.5,
        0.5,
        0.5,
        1
      ]
    },
    {
      "NAME": "colorB",
      "LABEL": "Colour B",
      "TYPE": "color",
      "DEFAULT": [
        0.5,
        0.5,
        0.5,
        1
      ]
    },
    {
      "NAME": "hue",
      "LABEL": "Hue",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 1
    }
  ]
}*/

void main() {
  vec2 p = (isf_FragNormCoord - 0.5) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0) * scale;
  float t = TIME * speed;
  float v = sin(p.x + t) + sin(p.y * 1.3 - t) + sin((p.x + p.y) * 0.7 + t * 1.7) + sin(length(p) * 1.5 - t * 1.3);
  vec3 phase = vec3(0.0, 0.33, 0.67) + hue;
  vec3 col = colorA.rgb + colorB.rgb * cos(6.2831853 * (v * 0.25 + phase));
  gl_FragColor = vec4(col, 1.0);
}
