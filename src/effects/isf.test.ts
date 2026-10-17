import { describe, expect, it } from 'vitest';
import { buildFragmentShader, defaultValue, evalExpression, IsfError, paramValue, parseIsf } from './isf';

const blur = `/*{
  "DESCRIPTION": "Two-pass blur",
  "CREDIT": "test",
  "ISFVSN": "2",
  "CATEGORIES": ["Blur"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "radius", "TYPE": "float", "DEFAULT": 4, "MIN": 0, "MAX": 32 },
    { "NAME": "mode", "TYPE": "long", "VALUES": [0, 1], "LABELS": ["Box", "Gauss"] },
    { "NAME": "tint", "TYPE": "color", "DEFAULT": [1, 0.5, 0] },
  ],
  "PASSES": [
    { "TARGET": "half", "WIDTH": "floor($WIDTH / 2)", "HEIGHT": "$HEIGHT/2" },
    { "TARGET": "trail", "PERSISTENT": true, "FLOAT": true },
    {}
  ]
}*/
void main() {
  vec4 c = IMG_NORM_PIXEL(inputImage, isf_FragNormCoord);
  vec4 d = IMG_PIXEL(half, gl_FragCoord.xy);
  vec2 s = IMG_SIZE(inputImage);
  gl_FragColor = mix(c, IMG_THIS_PIXEL(trail), 0.5) + texture2D(inputImage, vv_FragNormCoord) * 0.0;
}
`;

describe('ISF parsing', () => {
  it('reads the header, inputs and passes', () => {
    const isf = parseIsf(blur);
    expect(isf.kind).toBe('effect');
    expect(isf.categories).toEqual(['Blur']);
    expect(isf.inputs.map(i => `${i.name}:${i.type}`)).toEqual(['inputImage:image', 'radius:float', 'mode:long', 'tint:color']);
    expect(isf.passes).toEqual([
      { target: 'half', persistent: false, float: false, width: 'floor($WIDTH / 2)', height: '$HEIGHT/2' },
      { target: 'trail', persistent: true, float: true, width: undefined, height: undefined },
      { target: undefined, persistent: false, float: false, width: undefined, height: undefined },
    ]);
    expect(isf.bodyLine).toBe(17); // the line the header ends on
  });

  it('tells generators and transitions from effects', () => {
    expect(parseIsf('/*{ "INPUTS": [] }*/ void main() {}').kind).toBe('generator');
    expect(parseIsf(`/*{ "INPUTS": [
      { "NAME": "startImage", "TYPE": "image" }, { "NAME": "endImage", "TYPE": "image" },
      { "NAME": "progress", "TYPE": "float" } ] }*/`).kind).toBe('transition');
  });

  it('rejects broken files with a reason', () => {
    expect(() => parseIsf('void main() {}')).toThrow(IsfError);
    expect(() => parseIsf('/*{ "INPUTS": [ { "NAME": "x", "TYPE": "matrix" } ] }*/')).toThrow(/unsupported TYPE/);
    expect(() => parseIsf('/*{ "INPUTS": [ { "NAME": "TIME", "TYPE": "float" } ] }*/')).toThrow(/reserved/);
    expect(() => parseIsf('/*{ nope }*/')).toThrow(/valid JSON/);
  });
});

describe('ISF → GLSL ES 3.00', () => {
  const glsl = buildFragmentShader(parseIsf(blur));

  it('declares inputs, pass targets and built-ins', () => {
    expect(glsl.startsWith('#version 300 es')).toBe(true);
    expect(glsl).toContain('uniform float radius;');
    expect(glsl).toContain('uniform int mode;');
    expect(glsl).toContain('uniform vec4 tint;');
    expect(glsl).toContain('uniform sampler2D inputImage;');
    expect(glsl).toContain('uniform sampler2D half;');
    expect(glsl).toContain('uniform sampler2D trail;');
    expect(glsl).toContain('uniform vec2 RENDERSIZE;');
    expect(glsl).toContain('uniform float BEAT;');
  });

  it('rewrites the ISF macros and GLSL 1 idioms', () => {
    expect(glsl).toContain('isf_sample(inputImage, _inputImage_flip, isf_FragNormCoord)');
    expect(glsl).toContain('isf_samplePx(half, _half_flip, _half_imgSize, gl_FragCoord.xy)');
    expect(glsl).toContain('vec2 s = _inputImage_imgSize;');
    expect(glsl).toContain('isf_FragColor = mix(c, isf_sample(trail, _trail_flip, isf_FragNormCoord), 0.5)');
    expect(glsl).toContain('texture(inputImage, isf_FragNormCoord)');
    expect(glsl).not.toMatch(/gl_FragColor|texture2D|vv_FragNormCoord/);
  });
});

describe('pass sizes and parameter values', () => {
  it('evaluates size expressions', () => {
    const vars = { WIDTH: 1920, HEIGHT: 1080, scale: 0.25 };
    expect(evalExpression('$WIDTH/2', vars)).toBe(960);
    expect(evalExpression('floor($HEIGHT * $scale) + 1', vars)).toBe(271);
    expect(evalExpression('max($WIDTH, $HEIGHT) - (2 * 10)', vars)).toBe(1900);
    expect(evalExpression('-4 + 6', vars)).toBe(2);
    expect(() => evalExpression('$DEPTH', vars)).toThrow(IsfError);
    expect(() => evalExpression('alert(1)', vars)).toThrow(IsfError);
  });

  it('fills in defaults and rejects values that do not fit', () => {
    const [, radius, mode, tint] = parseIsf(blur).inputs;
    expect(defaultValue(radius)).toBe(4);
    expect(defaultValue(mode)).toBe(0);
    expect(defaultValue(tint)).toEqual([1, 0.5, 0, 1]);
    expect(paramValue(radius, 9)).toBe(9);
    expect(paramValue(radius, true)).toBe(4);
    expect(paramValue(tint, [0, 0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(paramValue(tint, [0, 0])).toEqual([1, 0.5, 0, 1]);
  });
});
