// ---------------------------------------------------------------------------
// ISF (Interactive Shader Format, isf.video) for WebGL2: parse the JSON
// header of an ISF fragment shader and translate its GLSL into GLSL ES 3.00
// with the ISF built-ins (IMG_PIXEL & co., RENDERSIZE, TIME, PASSINDEX …).
//
// Supported: inputs float / bool / long / color / point2D / event / image /
// audio / audioFFT (the audio input's analysis), multi-pass rendering with
// named and persistent buffers and size expressions. Not supported: custom
// vertex shaders, IMPORTED images. Extension: BPM and BEAT (beats of the
// master clock) for beat-synced shaders.
// ---------------------------------------------------------------------------

export type IsfInputType = 'float' | 'bool' | 'long' | 'color' | 'point2D' | 'image' | 'event' | 'audio' | 'audioFFT';

export interface IsfInput {
  name: string;
  type: IsfInputType;
  label?: string;
  default?: number | boolean | number[];
  min?: number | number[];
  max?: number | number[];
  values?: number[]; // long
  labels?: string[]; // long
}

export interface IsfPass {
  target?: string;
  persistent: boolean;
  float: boolean;
  width?: string; // expression, e.g. "$WIDTH/2"
  height?: string;
}

// effect: processes inputImage; generator: makes an image; transition: mixes
// startImage → endImage by progress
export type IsfKind = 'effect' | 'generator' | 'transition';

export interface IsfShader {
  label?: string; // display name (LABEL, an extension; else the file name)
  description: string;
  credit: string;
  categories: string[];
  inputs: IsfInput[];
  passes: IsfPass[];
  kind: IsfKind;
  body: string; // GLSL after the header
  bodyLine: number; // line of the file the body starts on (for compile errors)
}

export class IsfError extends Error {}

const INPUT_TYPES: IsfInputType[] = ['float', 'bool', 'long', 'color', 'point2D', 'image', 'event', 'audio', 'audioFFT'];
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Built-in uniform names a shader can't redeclare as inputs
const RESERVED = new Set(['PASSINDEX', 'RENDERSIZE', 'TIME', 'TIMEDELTA', 'FRAMEINDEX', 'DATE', 'isf_FragNormCoord']);

const asNumberArray = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every(v => typeof v === 'number') ? value : undefined;

const asNumberOrArray = (value: unknown): number | number[] | undefined =>
  typeof value === 'number' ? value : asNumberArray(value);

/** Parse an ISF fragment shader: its JSON header and GLSL body. */
export function parseIsf(source: string): IsfShader {
  const match = /\/\*\s*(\{[\s\S]*?\})\s*\*\//.exec(source);
  if (!match) throw new IsfError('No ISF header (a /*{ … }*/ JSON comment) found');
  let header: Record<string, unknown>;
  try {
    // Some ISF files carry trailing commas — tolerate them
    header = JSON.parse(match[1].replace(/,(\s*[}\]])/g, '$1'));
  } catch (error) {
    throw new IsfError(`The ISF header isn't valid JSON: ${(error as Error).message}`);
  }

  const inputs: IsfInput[] = [];
  for (const raw of Array.isArray(header.INPUTS) ? header.INPUTS : []) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.NAME === 'string' ? r.NAME : '';
    const type = r.TYPE as IsfInputType;
    if (!IDENTIFIER.test(name)) throw new IsfError(`Input "${name}" has no valid NAME`);
    if (RESERVED.has(name)) throw new IsfError(`Input "${name}" uses a reserved name`);
    if (!INPUT_TYPES.includes(type)) throw new IsfError(`Input "${name}" has an unsupported TYPE "${String(r.TYPE)}"`);
    inputs.push({
      name,
      type,
      label: typeof r.LABEL === 'string' ? r.LABEL : undefined,
      default: typeof r.DEFAULT === 'boolean' ? r.DEFAULT : asNumberOrArray(r.DEFAULT),
      min: asNumberOrArray(r.MIN),
      max: asNumberOrArray(r.MAX),
      values: asNumberArray(r.VALUES),
      labels: Array.isArray(r.LABELS) ? r.LABELS.map(String) : undefined,
    });
  }

  const rawPasses = Array.isArray(header.PASSES) && header.PASSES.length > 0 ? header.PASSES : [{}];
  const passes: IsfPass[] = rawPasses.map((raw: unknown) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const target = typeof r.TARGET === 'string' && r.TARGET ? r.TARGET : undefined;
    if (target !== undefined && !IDENTIFIER.test(target)) throw new IsfError(`Pass target "${target}" isn't a valid name`);
    const dimension = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v : undefined);
    return {
      target,
      persistent: r.PERSISTENT === true || r.PERSISTENT === 'true' || r.PERSISTENT === 1,
      float: r.FLOAT === true || r.FLOAT === 'true' || r.FLOAT === 1,
      width: dimension(r.WIDTH),
      height: dimension(r.HEIGHT),
    };
  });

  const imageNames = new Set(inputs.filter(i => i.type === 'image').map(i => i.name));
  const kind: IsfKind = imageNames.has('startImage') && imageNames.has('endImage') ? 'transition'
    : imageNames.has('inputImage') ? 'effect'
    : 'generator';

  return {
    label: typeof header.LABEL === 'string' && header.LABEL.trim() ? header.LABEL.trim() : undefined,
    description: typeof header.DESCRIPTION === 'string' ? header.DESCRIPTION : '',
    credit: typeof header.CREDIT === 'string' ? header.CREDIT : '',
    categories: Array.isArray(header.CATEGORIES) ? header.CATEGORIES.map(String) : [],
    inputs,
    passes,
    kind,
    body: source.slice(match.index + match[0].length),
    bodyLine: source.slice(0, match.index + match[0].length).split('\n').length,
  };
}

// ---- GLSL translation -------------------------------------------------------------

export const ISF_VERTEX = `#version 300 es
out vec2 isf_FragNormCoord;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  isf_FragNormCoord = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const imageUniforms = (name: string) =>
  `uniform sampler2D ${name};\nuniform vec2 _${name}_imgSize;\nuniform vec4 _${name}_imgRect;\nuniform bool _${name}_flip;\n`;

/** The ISF shader as a GLSL ES 3.00 fragment shader. */
export function buildFragmentShader(isf: IsfShader): string {
  const names = new Set(isf.inputs.map(i => i.name));
  let declarations = '';
  for (const input of isf.inputs) {
    switch (input.type) {
      case 'float': declarations += `uniform float ${input.name};\n`; break;
      case 'bool':
      case 'event': declarations += `uniform bool ${input.name};\n`; break;
      case 'long': declarations += `uniform int ${input.name};\n`; break;
      case 'color': declarations += `uniform vec4 ${input.name};\n`; break;
      case 'point2D': declarations += `uniform vec2 ${input.name};\n`; break;
      default: declarations += imageUniforms(input.name); // image, audio, audioFFT
    }
  }
  for (const pass of isf.passes) {
    if (pass.target && !names.has(pass.target)) {
      declarations += imageUniforms(pass.target);
      names.add(pass.target);
    }
  }
  const extensions = ['BPM', 'BEAT'].filter(n => !names.has(n)).map(n => `uniform float ${n};\n`).join('');

  const body = isf.body
    .replace(/^\s*#version.*$/gm, '')
    .replace(/\bIMG_NORM_PIXEL\(\s*(\w+)\s*,/g, 'isf_sample($1, _$1_flip,')
    .replace(/\bIMG_PIXEL\(\s*(\w+)\s*,/g, 'isf_samplePx($1, _$1_flip, _$1_imgSize,')
    .replace(/\bIMG_THIS_(?:NORM_)?PIXEL\(\s*(\w+)\s*\)/g, 'isf_sample($1, _$1_flip, isf_FragNormCoord)')
    .replace(/\bIMG_SIZE\(\s*(\w+)\s*\)/g, '_$1_imgSize')
    .replace(/\bgl_FragColor\b/g, 'isf_FragColor')
    .replace(/\bvv_FragNormCoord\b/g, 'isf_FragNormCoord')
    .replace(/\btexture2D\b/g, 'texture')
    .replace(/^\s*varying\s+/gm, 'in ');

  return `#version 300 es
precision highp float;
precision highp int;
in vec2 isf_FragNormCoord;
out vec4 isf_FragColor;
uniform int PASSINDEX;
uniform vec2 RENDERSIZE;
uniform float TIME;
uniform float TIMEDELTA;
uniform int FRAMEINDEX;
uniform vec4 DATE;
${extensions}${declarations}
vec4 isf_sample(sampler2D s, bool flip, vec2 c) { return texture(s, flip ? vec2(c.x, 1.0 - c.y) : c); }
vec4 isf_samplePx(sampler2D s, bool flip, vec2 size, vec2 px) { return isf_sample(s, flip, px / size); }
#line ${isf.bodyLine}
${body}`;
}

// ---- Pass size expressions ($WIDTH/2, floor($HEIGHT*0.5), …) ----------------------------

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, sqrt: Math.sqrt,
  min: Math.min, max: Math.max, pow: Math.pow,
};

/** Evaluate an ISF size expression; `vars` holds WIDTH, HEIGHT and input values (without $). */
export function evalExpression(expression: string, vars: Record<string, number>): number {
  const tokens = expression.match(/\$?[A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+(?:e[+-]?\d+)?|[-+*/(),]/gi) ?? [];
  if (tokens.join('') !== expression.replace(/\s+/g, '')) throw new IsfError(`Can't read the size "${expression}"`);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expect = (t: string) => {
    if (next() !== t) throw new IsfError(`Expected "${t}" in "${expression}"`);
  };
  const primary = (): number => {
    const t = next();
    if (t === undefined) throw new IsfError(`Unexpected end of "${expression}"`);
    if (t === '(') {
      const v = sum();
      expect(')');
      return v;
    }
    if (t === '-') return -primary();
    if (t === '+') return primary();
    if (/^[\d.]/.test(t)) return Number(t);
    const name = t.startsWith('$') ? t.slice(1) : t;
    if (FUNCTIONS[name] && peek() === '(') {
      next();
      const args = [sum()];
      while (peek() === ',') {
        next();
        args.push(sum());
      }
      expect(')');
      return FUNCTIONS[name](...args);
    }
    if (name in vars) return vars[name];
    throw new IsfError(`Unknown value "${t}" in "${expression}"`);
  };
  const product = (): number => {
    let v = primary();
    while (peek() === '*' || peek() === '/') v = next() === '*' ? v * primary() : v / primary();
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + product() : v - product();
    return v;
  };
  const value = sum();
  if (i !== tokens.length) throw new IsfError(`Can't read the size "${expression}"`);
  return value;
}

// ---- Parameter values ---------------------------------------------------------------

export type ParamValue = number | boolean | number[];

/** An input's default value, filled in where the file leaves it out. */
export const defaultValue = (input: IsfInput): ParamValue => {
  switch (input.type) {
    case 'float': return typeof input.default === 'number' ? input.default : typeof input.min === 'number' ? input.min : 0;
    case 'long': return typeof input.default === 'number' ? input.default : input.values?.[0] ?? 0;
    case 'bool':
    case 'event': return input.default === true || input.default === 1;
    case 'color': return Array.isArray(input.default) && input.default.length >= 3 ? [...input.default, 1].slice(0, 4) : [1, 1, 1, 1];
    case 'point2D': return Array.isArray(input.default) && input.default.length >= 2 ? input.default.slice(0, 2) : [0, 0];
    default: return 0;
  }
};

/** The slider range of a float input or one axis of a point (MIN/MAX, else 0..1). */
export const inputRange = (input: IsfInput, axis = 0): [number, number] => {
  const pick = (v: number | number[] | undefined, fallback: number) =>
    typeof v === 'number' ? v : Array.isArray(v) ? v[axis] ?? fallback : fallback;
  const min = pick(input.min, 0);
  const max = pick(input.max, 1);
  return max > min ? [min, max] : [min, min + 1];
};

/** A stored parameter value if it fits the input, else the default. */
export const paramValue = (input: IsfInput, value: ParamValue | undefined): ParamValue => {
  const fallback = defaultValue(input);
  if (value === undefined) return fallback;
  if (typeof fallback === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
  return Array.isArray(value) && value.length === fallback.length && value.every(Number.isFinite) ? value : fallback;
};
