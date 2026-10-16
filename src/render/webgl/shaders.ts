import { MAX_POLYGON_VERTICES } from '../frameMath';

// ---------------------------------------------------------------------------
// GLSL ES 3.00 shaders for the WebGL2 compositor.
//
// Geometry is drawn in composition px; the frame shader then maps each pixel
// backwards (see frameMath.ts for the reference implementation).
// ---------------------------------------------------------------------------

/** Quad vertices in composition px → clip space. */
export const QUAD_VERTEX = /* glsl */ `#version 300 es
in vec2 a_position;           // composition px
uniform vec2 u_compSize;
void main() {
  vec2 ndc = a_position / u_compSize * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

/** Full-target triangle for copies and the final present. */
export const FULLSCREEN_VERTEX = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const COPY_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform float u_gain; // master fader
out vec4 outColor;
void main() {
  vec4 c = texture(u_source, v_uv);
  outColor = vec4(c.rgb * u_gain, 1.0);
}
`;

export const BACKGROUND_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_targetSize;  // render target px
uniform vec4 u_color;
uniform bool u_hasMedia;
uniform sampler2D u_media;
uniform float u_mediaAspect;
uniform float u_stageAspect;
out vec4 outColor;
void main() {
  if (!u_hasMedia) {
    outColor = u_color;
    return;
  }
  vec2 uv = vec2(gl_FragCoord.x, u_targetSize.y - gl_FragCoord.y) / u_targetSize;
  // object-fit: cover
  if (u_mediaAspect > u_stageAspect) uv.x = 0.5 + (uv.x - 0.5) * (u_stageAspect / u_mediaAspect);
  else uv.y = 0.5 + (uv.y - 0.5) * (u_mediaAspect / u_stageAspect);
  outColor = vec4(texture(u_media, uv).rgb, 1.0);
}
`;

export const FRAME_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 u_targetSize;     // render target px
uniform vec2 u_compSize;       // composition px

// Geometry (see frameMath.ts)
uniform vec2 u_center;
uniform vec2 u_rot;            // cos, sin
uniform vec2 u_size;
uniform mat3 u_hinv;
uniform int u_shape;           // 0 rect, 1 circle, 2 polygon
uniform int u_vertexCount;
uniform vec2 u_vertices[${MAX_POLYGON_VERTICES}];
uniform vec4 u_softEdge;       // left, right, top, bottom px

// A clip's content transform and look (CSS filters, applied in CSS order)
struct Look {
  vec2 flip;
  float zoom;
  vec2 offset;
  int fit;                     // 0 stretch (test card), 1 cover
  float mediaAspect;
  float blur;                  // px (box space)
  float brightness;
  float contrast;
  float grayscale;
  float saturate;
  float hueRotate;             // radians
  float invert;
  float sepia;
};

// Content: the clip on screen, and during a dissolve the clip it replaces
uniform Look u_look;
uniform bool u_hasMedia;
uniform sampler2D u_media;
uniform Look u_fromLook;
uniform bool u_hasFrom;
uniform sampler2D u_fromMedia;
uniform float u_mix;           // dissolve position: 0 = from only, 1 = media only
uniform vec4 u_fill;           // editor placeholder colour (alpha 0 = none)
uniform float u_opacity;

// Blending against everything below
uniform int u_blendMode;       // 0 normal (fixed-function), see blend()
uniform sampler2D u_backdrop;

out vec4 outColor;

float sdBox(vec2 p, vec2 size) {
  vec2 d = max(-p, p - size);
  return max(d.x, d.y);
}

float sdPolygon(vec2 p) {
  float minDist = 1e9;
  bool inside = false;
  for (int i = 0; i < ${MAX_POLYGON_VERTICES}; i++) {
    if (i >= u_vertexCount) break;
    int j = i == 0 ? u_vertexCount - 1 : i - 1;
    vec2 a = u_vertices[i] * u_size;
    vec2 b = u_vertices[j] * u_size;
    vec2 e = b - a;
    vec2 w = p - a;
    float t = clamp(dot(w, e) / max(dot(e, e), 1e-9), 0.0, 1.0);
    minDist = min(minDist, length(w - e * t));
    if (((a.y > p.y) != (b.y > p.y)) && (p.x < e.x * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
  }
  return inside ? -minDist : minDist;
}

float coverage(float sd) {
  float aa = max(fwidth(sd), 1e-4);
  return clamp(0.5 - sd / aa, 0.0, 1.0);
}

vec3 colorMatrix(vec3 c, mat3 m) { return m * c; }

vec3 applyFilters(vec3 c, Look look) {
  c *= look.brightness;
  c = (c - 0.5) * look.contrast + 0.5;
  if (look.grayscale > 0.0) {
    float g = 1.0 - look.grayscale;
    c = colorMatrix(c, transpose(mat3(
      0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g,
      0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g,
      0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g)));
  }
  if (look.saturate != 1.0) {
    float s = look.saturate;
    c = colorMatrix(c, transpose(mat3(
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s)));
  }
  if (look.hueRotate != 0.0) {
    float co = cos(look.hueRotate);
    float si = sin(look.hueRotate);
    c = colorMatrix(c, transpose(mat3(
      0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
      0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.140, 0.072 - co * 0.072 - si * 0.283,
      0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072)));
  }
  if (look.invert > 0.0) c = mix(c, 1.0 - c, look.invert);
  if (look.sepia > 0.0) {
    float g = 1.0 - look.sepia;
    c = colorMatrix(c, transpose(mat3(
      0.393 + 0.607 * g, 0.769 - 0.769 * g, 0.189 - 0.189 * g,
      0.349 - 0.349 * g, 0.686 + 0.314 * g, 0.168 - 0.168 * g,
      0.272 - 0.272 * g, 0.534 - 0.534 * g, 0.131 + 0.869 * g)));
  }
  return clamp(c, 0.0, 1.0);
}

// ---- W3C compositing blend modes (B(Cb, Cs)) ----
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
float softLight(float b, float s) {
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
float colorDodge(float b, float s) { return b == 0.0 ? 0.0 : s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float colorBurn(float b, float s) { return b >= 1.0 ? 1.0 : s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
float hardLight(float b, float s) { return s <= 0.5 ? b * 2.0 * s : 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)); }

vec3 blend(vec3 b, vec3 s) {
  switch (u_blendMode) {
    case 1: return b * s;                                   // multiply
    case 2: return b + s - b * s;                           // screen
    case 3: return vec3(hardLight(s.r, b.r), hardLight(s.g, b.g), hardLight(s.b, b.b)); // overlay
    case 4: return min(b, s);                               // darken
    case 5: return max(b, s);                               // lighten
    case 6: return vec3(colorDodge(b.r, s.r), colorDodge(b.g, s.g), colorDodge(b.b, s.b));
    case 7: return vec3(colorBurn(b.r, s.r), colorBurn(b.g, s.g), colorBurn(b.b, s.b));
    case 8: return vec3(hardLight(b.r, s.r), hardLight(b.g, s.g), hardLight(b.b, s.b));
    case 9: return vec3(softLight(b.r, s.r), softLight(b.g, s.g), softLight(b.b, s.b));
    case 10: return abs(b - s);                             // difference
    case 11: return b + s - 2.0 * b * s;                    // exclusion
    case 12: return setLum(setSat(s, sat(b)), lum(b));      // hue
    case 13: return setLum(setSat(b, sat(s)), lum(b));      // saturation
    case 14: return setLum(s, lum(b));                      // color
    case 15: return setLum(b, lum(s));                      // luminosity
    default: return s;
  }
}

vec4 sampleMedia(sampler2D media, vec2 uv, Look look) {
  if (look.blur <= 0.0) return texture(media, uv);
  // 12-tap Poisson disc; radius ≈ 2σ in box px, converted to uv
  const vec2 taps[12] = vec2[12](
    vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
    vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
    vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
  vec2 radius = (2.0 * look.blur) / (u_size * look.zoom);
  vec4 sum = texture(media, uv);
  for (int i = 0; i < 12; i++) sum += texture(media, uv + taps[i] * radius);
  return sum / 13.0;
}

// A clip's colour at a box position, premultiplied
vec4 content(vec2 box, sampler2D media, Look look) {
  // Box → content element (undo flip, zoom about the centre, pan)
  vec2 p = (box - u_size * 0.5) * look.flip;
  p = p / look.zoom - look.offset;
  vec2 uv = p / u_size + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); // zoomed out
  if (look.fit == 1) {
    float boxAspect = u_size.x / u_size.y;
    if (look.mediaAspect > boxAspect) uv.x = 0.5 + (uv.x - 0.5) * (boxAspect / look.mediaAspect);
    else uv.y = 0.5 + (uv.y - 0.5) * (look.mediaAspect / boxAspect);
  }
  vec4 c = sampleMedia(media, uv, look);
  return vec4(applyFilters(c.rgb, look) * c.a, c.a);
}

void main() {
  vec2 targetPx = vec2(gl_FragCoord.x, u_targetSize.y - gl_FragCoord.y);
  vec2 comp = targetPx * (u_compSize / u_targetSize);

  // Composition → warped local (undo rotation) → unwarped box (H⁻¹)
  vec2 d = comp - u_center;
  vec2 local = vec2(d.x * u_rot.x + d.y * u_rot.y, -d.x * u_rot.y + d.y * u_rot.x) + u_size * 0.5;
  vec3 hp = u_hinv * vec3(local, 1.0);
  vec2 box = hp.xy / hp.z;

  // Shape coverage (antialiased) — content only exists inside the box. One
  // combined distance so fwidth() runs in uniform control flow.
  vec2 n = (box - u_size * 0.5) / (u_size * 0.5);
  float sdShape = u_shape == 1 ? (length(n) - 1.0) * min(u_size.x, u_size.y) * 0.5
                : u_shape == 2 ? sdPolygon(box)
                : -1e9;
  float alpha = coverage(max(sdBox(box, u_size), sdShape));
  if (alpha <= 0.0) discard;

  // Soft edges (linear ramps at the box edges, like the CSS masks)
  if (u_softEdge.x > 0.0) alpha *= clamp(box.x / u_softEdge.x, 0.0, 1.0);
  if (u_softEdge.y > 0.0) alpha *= clamp((u_size.x - box.x) / u_softEdge.y, 0.0, 1.0);
  if (u_softEdge.z > 0.0) alpha *= clamp(box.y / u_softEdge.z, 0.0, 1.0);
  if (u_softEdge.w > 0.0) alpha *= clamp((u_size.y - box.y) / u_softEdge.w, 0.0, 1.0);

  // The layer's content (premultiplied): its clip, dissolving from the
  // previous one — mixed before blending, so blend modes apply once
  vec4 pm = u_hasMedia ? content(box, u_media, u_look) : vec4(u_fill.rgb * u_fill.a, u_fill.a);
  if (u_hasFrom) pm = mix(content(box, u_fromMedia, u_fromLook), pm, u_mix);
  vec4 src = vec4(pm.a > 0.0 ? pm.rgb / pm.a : vec3(0.0), pm.a);

  float a = src.a * alpha * u_opacity;
  if (a <= 0.0) discard;

  if (u_blendMode == 0) {
    outColor = vec4(src.rgb * a, a); // premultiplied, blended by the GPU
  } else {
    vec3 backdrop = texture(u_backdrop, gl_FragCoord.xy / u_targetSize).rgb;
    outColor = vec4(mix(backdrop, blend(backdrop, src.rgb), a), 1.0);
  }
}
`;

export const BLEND_MODE_CODES: Record<string, number> = {
  normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, 'color-dodge': 6, 'color-burn': 7,
  'hard-light': 8, 'soft-light': 9, difference: 10, exclusion: 11, hue: 12, saturation: 13, color: 14, luminosity: 15,
};
