/*{
  "DESCRIPTION": "Video feedback trails \u2014 zoom, turn and fade the last frame under the new one",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Feedback",
  "CATEGORIES": [
    "Feedback"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "amount",
      "LABEL": "Trail",
      "TYPE": "float",
      "DEFAULT": 0.85,
      "MIN": 0,
      "MAX": 0.99
    },
    {
      "NAME": "zoom",
      "LABEL": "Zoom",
      "TYPE": "float",
      "DEFAULT": 1.01,
      "MIN": 0.9,
      "MAX": 1.1
    },
    {
      "NAME": "rotate",
      "LABEL": "Turn",
      "TYPE": "float",
      "DEFAULT": 0.002,
      "MIN": -0.05,
      "MAX": 0.05
    },
    {
      "NAME": "hue",
      "LABEL": "Hue drift",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": 0,
      "MAX": 0.1
    }
  ],
  "PASSES": [
    {
      "TARGET": "trails",
      "PERSISTENT": true
    },
    {}
  ]
}*/

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
  vec2 d = (isf_FragNormCoord - 0.5) * aspect / zoom;
  float a = rotate * 6.2831853;
  d = vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  vec4 last = IMG_NORM_PIXEL(trails, d / aspect + 0.5);
  if (hue > 0.0) last.rgb = hsv2rgb(rgb2hsv(last.rgb) + vec3(hue, 0.0, 0.0));
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec4 o = max(c, last * amount);
  gl_FragColor = PASSINDEX == 0 ? o : IMG_THIS_PIXEL(trails);
}
