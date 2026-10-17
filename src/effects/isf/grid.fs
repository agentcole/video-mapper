/*{
  "DESCRIPTION": "Lines for lining up projectors",
  "CREDIT": "Video Mapper (MIT)",
  "ISFVSN": "2",
  "LABEL": "Grid",
  "CATEGORIES": [
    "Generator",
    "Utility"
  ],
  "INPUTS": [
    {
      "NAME": "columns",
      "LABEL": "Columns",
      "TYPE": "float",
      "DEFAULT": 16,
      "MIN": 1,
      "MAX": 64
    },
    {
      "NAME": "rows",
      "LABEL": "Rows",
      "TYPE": "float",
      "DEFAULT": 9,
      "MIN": 1,
      "MAX": 64
    },
    {
      "NAME": "thickness",
      "LABEL": "Line (px)",
      "TYPE": "float",
      "DEFAULT": 2,
      "MIN": 1,
      "MAX": 16
    },
    {
      "NAME": "line",
      "LABEL": "Line",
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
    },
    {
      "NAME": "diagonals",
      "LABEL": "Diagonals",
      "TYPE": "bool",
      "DEFAULT": false
    }
  ]
}*/

void main() {
  vec2 cell = RENDERSIZE / vec2(floor(columns), floor(rows));
  vec2 d = abs(mod(gl_FragCoord.xy + thickness * 0.5, cell) - thickness * 0.5);
  float on = step(min(d.x, d.y), thickness * 0.5);
  vec2 border = min(gl_FragCoord.xy, RENDERSIZE - gl_FragCoord.xy);
  on = max(on, step(min(border.x, border.y), thickness));
  if (diagonals) {
    vec2 uv = gl_FragCoord.xy / RENDERSIZE;
    float diag = min(abs(uv.x - uv.y), abs(uv.x - (1.0 - uv.y))) * min(RENDERSIZE.x, RENDERSIZE.y);
    on = max(on, step(diag, thickness * 0.5));
  }
  gl_FragColor = mix(background, line, on);
}
