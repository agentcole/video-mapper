/*{
  "DESCRIPTION": "Brightness, contrast, saturation and gamma",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Color Adjust",
  "CATEGORIES": [
    "Color"
  ],
  "INPUTS": [
    {
      "NAME": "inputImage",
      "TYPE": "image"
    },
    {
      "NAME": "brightness",
      "LABEL": "Brightness",
      "TYPE": "float",
      "DEFAULT": 0,
      "MIN": -1,
      "MAX": 1
    },
    {
      "NAME": "contrast",
      "LABEL": "Contrast",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0,
      "MAX": 3
    },
    {
      "NAME": "saturation",
      "LABEL": "Saturation",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0,
      "MAX": 3
    },
    {
      "NAME": "gamma",
      "LABEL": "Gamma",
      "TYPE": "float",
      "DEFAULT": 1,
      "MIN": 0.2,
      "MAX": 3
    }
  ]
}*/

void main() {
  vec4 c = IMG_THIS_PIXEL(inputImage);
  vec3 rgb = c.rgb + brightness;
  rgb = (rgb - 0.5) * contrast + 0.5;
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luma), rgb, saturation);
  rgb = pow(clamp(rgb, 0.0, 1.0), vec3(1.0 / gamma));
  gl_FragColor = vec4(rgb, c.a);
}
