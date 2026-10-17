/*{
  "DESCRIPTION": "Test signal: colour bars with a grey ramp",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Color Bars",
  "CATEGORIES": [
    "Generator",
    "Utility"
  ],
  "INPUTS": []
}*/

void main() {
  vec2 uv = isf_FragNormCoord;
  vec3 bars[7] = vec3[7](vec3(0.75), vec3(0.75, 0.75, 0.0), vec3(0.0, 0.75, 0.75), vec3(0.0, 0.75, 0.0),
                          vec3(0.75, 0.0, 0.75), vec3(0.75, 0.0, 0.0), vec3(0.0, 0.0, 0.75));
  vec3 c;
  if (uv.y > 0.25) {
    c = bars[int(clamp(floor(uv.x * 7.0), 0.0, 6.0))];
  } else if (uv.y > 0.15) {
    c = vec3(floor(uv.x * 11.0) / 10.0);
  } else {
    c = uv.x < 0.25 ? vec3(0.0, 0.13, 0.3) : uv.x < 0.5 ? vec3(1.0) : uv.x < 0.75 ? vec3(0.2, 0.0, 0.42) : vec3(0.0);
  }
  gl_FragColor = vec4(c, 1.0);
}
