/*{
  "DESCRIPTION": "Two colours, at an angle; can scroll",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Linear Gradient",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "from",
      "LABEL": "From",
      "TYPE": "color",
      "DEFAULT": [
        0.05,
        0,
        0.3,
        1
      ]
    },
    {
      "NAME": "to",
      "LABEL": "To",
      "TYPE": "color",
      "DEFAULT": [
        1,
        0.2,
        0.4,
        1
      ]
    },
    {
      "NAME": "angle",
      "LABEL": "Angle",
      "TYPE": "float",
      "DEFAULT": 0.25,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "speed",
      "LABEL": "Scroll",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -2,
      "MAX": 2
    },
    {
      "NAME": "repeat",
      "LABEL": "Repeat",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  float a = angle * 6.2831853;
  vec2 d = vec2(cos(a), sin(a));
  vec2 p = (isf_FragNormCoord - 0.5) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  float t = dot(p, d) + 0.5 + TIME * speed * 0.25;
  t = repeat ? abs(mod(t, 2.0) - 1.0) : clamp(t, 0.0, 1.0);
  gl_FragColor = mix(from, to, t);
}
