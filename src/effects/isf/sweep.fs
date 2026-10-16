/*{
  "DESCRIPTION": "A bar sweeping across, free or on the beat",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Sweep",
  "CATEGORIES": [
    "Generator"
  ],
  "INPUTS": [
    {
      "NAME": "direction",
      "LABEL": "Direction",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3
      ],
      "LABELS": [
        "Left \u2192 right",
        "Right \u2192 left",
        "Up",
        "Down"
      ],
      "DEFAULT": 0
    },
    {
      "NAME": "width",
      "LABEL": "Width",
      "TYPE": "float",
      "DEFAULT": 0.1,
      "MIN": 0.01,
      "MAX": 1
    },
    {
      "NAME": "speed",
      "LABEL": "Sweeps per second",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0.05,
      "MAX": 4
    },
    {
      "NAME": "beat",
      "LABEL": "One sweep per beat",
      "TYPE": "bool",
      "DEFAULT": true
    },
    {
      "NAME": "color",
      "LABEL": "Colour",
      "TYPE": "color",
      "DEFAULT": [
        1,
        1,
        1,
        1
      ]
    },
    {
      "NAME": "background",
      "LABEL": "Background",
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
  float t = fract(beat ? BEAT : TIME * speed);
  float x = direction == 0 ? isf_FragNormCoord.x : direction == 1 ? 1.0 - isf_FragNormCoord.x : direction == 2 ? isf_FragNormCoord.y : 1.0 - isf_FragNormCoord.y;
  float pos = t * (1.0 + width) - width;
  float k = step(pos, x) * step(x, pos + width);
  gl_FragColor = mix(background, color, k);
}
