/*{
  "DESCRIPTION": "Make one colour transparent",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Chroma Key",
  "CATEGORIES": [
    "Key"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "key",
      "LABEL": "Key colour",
      "TYPE": "color",
      "DEFAULT": [
        0,
        1,
        0,
        1
      ]
    },
    {
      "NAME": "threshold",
      "LABEL": "Threshold",
      "TYPE": "float",
      "DEFAULT": 0.3,
      "MIN": 0,
      "MAX": 1
    },
    {
      "NAME": "softness",
      "LABEL": "Softness",
      "TYPE": "float",
      "DEFAULT": 0.1,
      "MIN": 0,
      "MAX": 0.5
    },
    {
      "NAME": "spill",
      "LABEL": "Spill removal",
      "TYPE": "float",
      "DEFAULT": 0.5,
      "MIN": 0,
      "MAX": 1
    }
  ]
}*/

vec2 chroma(vec3 c) { return vec2(dot(c, vec3(-0.169, -0.331, 0.5)), dot(c, vec3(0.5, -0.419, -0.081))); }
void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  float d = distance(chroma(c.rgb), chroma(key.rgb));
  float a = smoothstep(threshold, threshold + softness + 0.0001, d);
  vec3 rgb = c.rgb;
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(rgb, vec3(luma), spill * (1.0 - a));
  gl_FragColor = vec4(rgb, c.a * a);
}
