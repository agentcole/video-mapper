/*{
  "DESCRIPTION": "Flash on the beat (master clock)",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Strobe",
  "CATEGORIES": [
    "Beat"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "rate",
      "LABEL": "Rate",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3,
        4
      ],
      "LABELS": [
        "Every 4 beats",
        "Every 2 beats",
        "Every beat",
        "Half beats",
        "Quarter beats"
      ],
      "DEFAULT": 2
    },
    {
      "NAME": "duration",
      "LABEL": "Flash length",
      "TYPE": "float",
      "DEFAULT": 0.25,
      "MIN": 0.05,
      "MAX": 1
    },
    {
      "NAME": "color",
      "LABEL": "Flash colour",
      "TYPE": "color",
      "DEFAULT": [
        1,
        1,
        1,
        1
      ]
    },
    {
      "NAME": "blackout",
      "LABEL": "Black between flashes",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  float div = rate == 0 ? 0.25 : rate == 1 ? 0.5 : rate == 2 ? 1.0 : rate == 3 ? 2.0 : 4.0;
  float phase = fract(BEAT * div);
  vec4 c = IMG_THIS_PIXEL(inputImage);
  bool on = phase < duration;
  gl_FragColor = on ? vec4(color.rgb, c.a) : (blackout ? vec4(0.0, 0.0, 0.0, c.a) : c);
}
