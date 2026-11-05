import type { NeutralRamp } from "./neutral";
import { STATUS_HUES, STATUS_NAMES, type StatusName, type ThemeOptions } from "./theme";

/**
 * Share code (docs/SPEC-builder.md 2): `a` (format version) + base-61 payload + 1 check character.
 * Same configuration, same code; a code never depends on anything that can change (presets are expanded to explicit values).
 */

/** Bumped whenever the colors produced for an existing configuration change (docs/SPEC-builder.md 2.2, D20). */
export const ENGINE_EPOCH = 1;
/** For each epoch, the package versions that produce its colors. `last: null` = still current. */
export const EPOCH_VERSIONS: Record<number, { first: string; last: string | null }> = { 1: { first: "0.2.0", last: null } };

/** 61 characters, no `z` (so that every digit is < 61, a prime) and no `-`/`_` (double-click selects a whole code). */
export const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy";
const P = 61;
const VERSION_CHAR = "a";

export type NeutralChoice = "neutral" | "cool" | "warm" | "auto" | { hue: number; chroma: number; chromaDark?: number; canvasDark?: number };
/** Normalized configuration: every number is already on the grid the code can hold. */
export interface ThemeConfig {
  hue: number;
  kappa: number;
  neutral: NeutralChoice;
  pageStep: 1 | 2;
  primaryMode: "accessible" | "vivid";
  status: Partial<Record<StatusName, number>>;
}
export interface ThemeConfigInput {
  hue: number;
  kappa?: number;
  neutral?: NeutralChoice;
  pageStep?: 1 | 2;
  primaryMode?: "accessible" | "vivid";
  status?: Partial<Record<StatusName, number>>;
}

export type CodeErrorKind = "length" | "alphabet" | "version" | "checksum" | "epoch" | "range" | "padding" | "noncanonical";
export class CodeError extends Error {
  constructor(public code: CodeErrorKind, message: string) {
    super(message);
    this.name = "CodeError";
  }
}

// ---- quantization -------------------------------------------------------------------------------------------------
const fix = (n: number, d: number) => Number(n.toFixed(d));
const hueUnits = (h: number) => (((Math.round(h * 10) % 3600) + 3600) % 3600);
const unitsToHue = (u: number) => fix(u / 10, 1);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const kappaUnits = (k: number) => clamp(Math.round((k - 0.35) * 100), 0, 50);
const unitsToKappa = (u: number) => fix(0.35 + u / 100, 2);
const chromaUnits = (c: number) => clamp(Math.round(c / 0.0005), 0, 255);
const unitsToChroma = (u: number) => fix(u * 0.0005, 4);
const canvasUnits = (l: number) => clamp(Math.round((l - 0.1) / 0.001), 0, 255);
const unitsToCanvas = (u: number) => fix(0.1 + u * 0.001, 3);

const NEUTRAL_KINDS = ["neutral", "cool", "warm", "auto"] as const;

/** The one configuration a given input stands for (rounding, clamping, dropping values equal to the defaults). */
export function normalizeConfig(c: ThemeConfigInput): ThemeConfig {
  let neutral: NeutralChoice = c.neutral ?? "neutral";
  if (typeof neutral === "object") {
    const chroma = unitsToChroma(chromaUnits(neutral.chroma));
    let chromaDark = neutral.chromaDark === undefined ? undefined : unitsToChroma(chromaUnits(neutral.chromaDark));
    if (chromaDark === chroma) chromaDark = undefined;
    const canvasDark = neutral.canvasDark === undefined ? undefined : unitsToCanvas(canvasUnits(neutral.canvasDark));
    const tinted = chroma > 0 || (chromaDark ?? 0) > 0;
    const hue = tinted ? unitsToHue(hueUnits(neutral.hue)) : 0;
    if (!tinted) chromaDark = undefined;
    if (!tinted && canvasDark === undefined) neutral = "neutral";
    else neutral = { hue, chroma, ...(chromaDark !== undefined && { chromaDark }), ...(canvasDark !== undefined && { canvasDark }) };
  }
  const status: Partial<Record<StatusName, number>> = {};
  for (const s of STATUS_NAMES) {
    const v = c.status?.[s];
    if (v === undefined) continue;
    const h = unitsToHue(hueUnits(v));
    if (h !== STATUS_HUES[s]) status[s] = h;
  }
  return {
    hue: unitsToHue(hueUnits(c.hue)),
    kappa: c.kappa === undefined ? 0.85 : unitsToKappa(kappaUnits(c.kappa)),
    neutral,
    pageStep: c.pageStep === 2 ? 2 : 1,
    primaryMode: c.primaryMode === "vivid" ? "vivid" : "accessible",
    status,
  };
}

/** Options for `buildTheme` that a configuration stands for. */
export function configToThemeOptions(c: ThemeConfig): ThemeOptions {
  const n = c.neutral;
  const neutral: ThemeOptions["neutral"] =
    typeof n === "string" ? n : ({ hue: n.hue, chroma: n.chroma, ...(n.chromaDark !== undefined && { chromaDark: n.chromaDark }), ...(n.canvasDark !== undefined && { canvas: { dark: n.canvasDark } }) } satisfies NeutralRamp);
  return { hue: c.hue, kappa: c.kappa, neutral, pageStep: c.pageStep, primaryMode: c.primaryMode, status: { ...c.status } };
}

// ---- bits ----------------------------------------------------------------------------------------------------------
class Writer {
  n = 1n; // sentinel: keeps leading zero bits
  put(v: number, bits: number) { this.n = (this.n << BigInt(bits)) | BigInt(v); }
}
class Reader {
  constructor(private s: string) {}
  get left() { return this.s.length; }
  get(bits: number): number {
    if (this.s.length < bits) throw new CodeError("padding", "the code is truncated");
    const v = parseInt(this.s.slice(0, bits) || "0", 2);
    this.s = this.s.slice(bits);
    return v;
  }
}

// ---- checksum: sum of position * digit over a prime modulus --------------------------------------------------------
const modpow = (b: number, e: number) => { let r = 1; for (let i = 0; i < e; i++) r = (r * b) % P; return r; };
function checkDigit(d: number[]): number {
  let s = 0;
  d.forEach((x, i) => (s = (s + (i + 1) * x) % P));
  return (((P - s) % P) * modpow((d.length + 1) % P, P - 2)) % P; // so that sum_{i<=n+1} i*d_i = 0 (mod 61), d_{n+1} = check
}
const toDigits = (n: bigint) => { const d: number[] = []; while (n > 0n) { d.unshift(Number(n % 61n)); n /= 61n; } return d; };

/** @internal Wraps a payload (with its leading sentinel bit) into a full code. Exposed for tests of malformed payloads. */
export function sealPayload(n: bigint): string {
  const d = toDigits(n);
  return VERSION_CHAR + [...d, checkDigit(d)].map((x) => CODE_ALPHABET[x]).join("");
}

// ---- encode / decode -----------------------------------------------------------------------------------------------
export function encodeConfig(config: ThemeConfig, { epoch = ENGINE_EPOCH }: { epoch?: number } = {}): string {
  const c = normalizeConfig(config);
  const w = new Writer();
  const kf = c.kappa !== 0.85;
  const mask = STATUS_NAMES.reduce((m, s, i) => m | (c.status[s] !== undefined ? 1 << i : 0), 0);
  const kind = typeof c.neutral === "string" ? NEUTRAL_KINDS.indexOf(c.neutral) : 4;
  w.put(epoch, 3);
  w.put(hueUnits(c.hue), 12);
  w.put(kf ? 1 : 0, 1);
  w.put(kind, 3);
  w.put(c.pageStep === 2 ? 1 : 0, 1);
  w.put(c.primaryMode === "vivid" ? 1 : 0, 1);
  w.put(mask, 4);
  if (kf) w.put(kappaUnits(c.kappa), 6);
  if (typeof c.neutral === "object") {
    const n = c.neutral;
    w.put(hueUnits(n.hue), 12);
    w.put(chromaUnits(n.chroma), 8);
    w.put(n.chromaDark !== undefined ? 1 : 0, 1);
    if (n.chromaDark !== undefined) w.put(chromaUnits(n.chromaDark), 8);
    w.put(n.canvasDark !== undefined ? 1 : 0, 1);
    if (n.canvasDark !== undefined) w.put(canvasUnits(n.canvasDark), 8);
  }
  STATUS_NAMES.forEach((s, i) => { if (mask & (1 << i)) w.put(hueUnits(c.status[s]!), 12); });
  return sealPayload(w.n);
}

export interface DecodedCode { config: ThemeConfig; epoch: number; warnings: string[] }
export interface DecodeOptions { engineEpoch?: number; epochVersions?: Record<number, { first: string; last: string | null }> }

export function decodeCode(code: string, { engineEpoch = ENGINE_EPOCH, epochVersions = EPOCH_VERSIONS }: DecodeOptions = {}): DecodedCode {
  if (typeof code !== "string" || code.length < 7 || code.length > 22) throw new CodeError("length", "a code has 7 to 22 characters");
  const digits: number[] = [];
  for (const ch of code) {
    const i = CODE_ALPHABET.indexOf(ch);
    if (i < 0) throw new CodeError("alphabet", `invalid character "${ch}" (codes use 0-9, A-Z and a-y)`);
    digits.push(i);
  }
  if (code[0] !== VERSION_CHAR) throw new CodeError("version", `unknown code format "${code[0]}" (this package reads "${VERSION_CHAR}")`);
  const body = digits.slice(1, -1), check = digits.at(-1)!;
  if (checkDigit(body) !== check) throw new CodeError("checksum", "wrong check character: the code was mistyped, check it again");

  let n = 0n;
  for (const d of body) n = n * 61n + BigInt(d);
  const r = new Reader(n.toString(2).slice(1)); // drop the sentinel
  const epoch = r.get(3);
  if (epoch === 0) throw new CodeError("epoch", "invalid epoch 0");
  if (epoch > engineEpoch) throw new CodeError("epoch", `this code was made with a newer gennex-color (epoch ${epoch}); upgrade the package (this one reads up to epoch ${engineEpoch})`);
  const hue = r.get(12);
  if (hue >= 3600) throw new CodeError("range", "hue out of range");
  const kf = r.get(1), kind = r.get(3), page = r.get(1), pm = r.get(1), mask = r.get(4);
  if (kind > 4) throw new CodeError("range", "unknown neutral kind");
  let kappa = 0.85;
  if (kf) { const k = r.get(6); if (k > 50) throw new CodeError("range", "kappa out of range"); kappa = unitsToKappa(k); }
  let neutral: NeutralChoice;
  if (kind < 4) neutral = NEUTRAL_KINDS[kind];
  else {
    const nh = r.get(12);
    if (nh >= 3600) throw new CodeError("range", "neutral hue out of range");
    const chroma = unitsToChroma(r.get(8));
    const chromaDark = r.get(1) ? unitsToChroma(r.get(8)) : undefined;
    const canvasDark = r.get(1) ? unitsToCanvas(r.get(8)) : undefined;
    neutral = { hue: unitsToHue(nh), chroma, ...(chromaDark !== undefined && { chromaDark }), ...(canvasDark !== undefined && { canvasDark }) };
  }
  const status: Partial<Record<StatusName, number>> = {};
  for (let i = 0; i < 4; i++) if (mask & (1 << i)) {
    const sh = r.get(12);
    if (sh >= 3600) throw new CodeError("range", "status hue out of range");
    status[STATUS_NAMES[i]] = unitsToHue(sh);
  }
  if (r.left > 0) throw new CodeError("padding", "the code has extra data");
  const config: ThemeConfig = { hue: unitsToHue(hue), kappa, neutral, pageStep: page ? 2 : 1, primaryMode: pm ? "vivid" : "accessible", status };
  // One configuration, one code: anything that does not re-encode to itself (flags on for default values, grid-unaligned numbers...) is refused.
  if (encodeConfig(normalizeConfig(config), { epoch }) !== code || JSON.stringify(normalizeConfig(config)) !== JSON.stringify(config)) {
    throw new CodeError("noncanonical", "the code is not in canonical form");
  }
  const warnings: string[] = [];
  if (epoch < engineEpoch) {
    const v = epochVersions[epoch];
    const ver = v ? (v.last ?? v.first) : "<unknown>";
    warnings.push(`This code was made with epoch ${epoch}; this package is epoch ${engineEpoch}, so the colors will differ. To reproduce them run: npx gennex-color@${ver} apply ${code}`);
  }
  return { config, epoch, warnings };
}
