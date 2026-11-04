import { contrast, toHex } from "./color";
import type { Mode, Oklch } from "./scale";

export type NeutralRampName = "cool" | "neutral" | "warm";
export interface NeutralRamp {
  hue: number;
  /** chroma at step 9 (the peak) */
  chroma: number;
  /** chroma per step relative to `chroma`; default TINT */
  tint?: readonly number[];
  /** lightness of step 1 per mode; steps 1-8 shift together (SPEC 3.4 canvas) */
  canvas?: { light?: number; dark?: number };
}
export interface NeutralScale {
  /** steps[0] is step 1 ... steps[11] is step 12 */
  steps: Oklch[];
  hex: string[];
}
/** A translucent color that, composited over step 1, reproduces a solid step. */
export interface AlphaStep { r: number; g: number; b: number; alpha: number; css: string }

/** Chroma is at step 9 (the peak); hue is OKLCH degrees. SPEC 5.2. */
export const NEUTRAL_RAMPS: Record<NeutralRampName, NeutralRamp> = {
  cool: { hue: 255, chroma: 0.016 },
  neutral: { hue: 0, chroma: 0 },
  // Paper-like: step 1 ~ oklch(0.975 0.006 68). Chroma is flatter across steps than the default profile.
  warm: { hue: 68, chroma: 0.014, tint: [0.43, 0.48, 0.54, 0.6, 0.66, 0.72, 0.78, 0.86, 1, 0.93, 0.86, 0.74], canvas: { light: 0.975 } },
};
/** Chroma of the seed-following ramp (D5). */
export const AUTO_CHROMA = 0.016;
export const autoRamp = (seedHue: number): NeutralRamp => ({ hue: ((seedHue % 360) + 360) % 360, chroma: AUTO_CHROMA });

// Lightness of Radix 3.0.0 gray (C = 0), rounded to 3 digits.
const L: Record<Mode, number[]> = {
  light: [0.991, 0.982, 0.955, 0.931, 0.907, 0.885, 0.851, 0.792, 0.643, 0.61, 0.503, 0.244],
  dark: [0.178, 0.213, 0.252, 0.285, 0.313, 0.348, 0.402, 0.489, 0.538, 0.583, 0.77, 0.949],
};
// Chroma relative to step 9: mean slate/mauve/sand profile at steps 1,2,3,6,9,11,12; the rest interpolated linearly.
const TINT = [0.09, 0.15, 0.26, 0.353, 0.447, 0.54, 0.693, 0.847, 1, 0.92, 0.84, 0.7];

const T11 = 4.55, T12 = 7.1; // a hair above the 4.5 / 7 test floors (8-bit rounding)

export function generateNeutral({ mode, ramp }: { mode: Mode; ramp: NeutralRampName | NeutralRamp }): NeutralScale {
  const { hue, chroma, tint = TINT, canvas } = typeof ramp === "string" ? NEUTRAL_RAMPS[ramp] : ramp;
  const shift = canvas?.[mode] === undefined ? 0 : canvas[mode]! - L[mode][0];
  const steps = L[mode].map((l, i): Oklch => ({ l: i < 8 ? l + shift : l, c: chroma * tint[i], h: hue }));
  // A shifted canvas moves surfaces toward the text color; keep s11/s12 passing on steps 1-4 (muted-foreground sits on accent = s4).
  const dir = mode === "light" ? -1 : 1;
  for (const [i, target] of [[10, T11], [11, T12]] as const) {
    for (let k = 0; k < 200 && !ch4(steps, i, target); k++) steps[i] = { ...steps[i], l: steps[i].l + dir * 0.002 };
  }
  return { steps, hex: steps.map(toHex) };
}
const ch4 = (steps: Oklch[], i: number, target: number) => {
  const t = toHex(steps[i]);
  return [0, 1, 2, 3].every((b) => contrast(t, toHex(steps[b])) >= target);
};

const ch = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/**
 * For each step, the lowest-alpha color that composites (sRGB source-over, as CSS) over step 1 into that step.
 * Alpha is raised to the smallest value that keeps every channel of the color inside 0..255, then the color is solved.
 * Direction (darken in light, lighten in dark) falls out of the data.
 */
export function neutralAlpha(scale: NeutralScale): AlphaStep[] {
  const bg = ch(scale.hex[0]);
  return scale.hex.map((hex) => {
    const t = ch(hex);
    let a = 0;
    for (let c = 0; c < 3; c++) {
      const d = t[c] - bg[c];
      if (d !== 0) a = Math.max(a, d > 0 ? d / (255 - bg[c]) : -d / bg[c]);
    }
    if (a === 0) return { r: 0, g: 0, b: 0, alpha: 0, css: "rgb(0 0 0 / 0)" };
    a = Math.ceil(a * 1000) / 1000;
    const [r, g, b] = bg.map((x, c) => Math.min(255, Math.max(0, Math.round(x + (t[c] - x) / a))));
    return { r, g, b, alpha: a, css: `rgb(${r} ${g} ${b} / ${a})` };
  });
}

/** Radix 3.0.0 black-a1..12 / white-a1..12. */
export const BLACK_ALPHA: readonly number[] = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
export const WHITE_ALPHA: readonly number[] = BLACK_ALPHA;


/**
 * Input border (D4 strict): the lightest neutral (darkest in dark mode) that is still >= 3:1 (WCAG 1.4.11) on every
 * given surface step (0-based). Tint = step 9's hue/chroma. Surfaces default to step 1 only (card = page = step 1).
 */
export function neutralBorder(scale: NeutralScale, surfaces: number[] = [0]): { hex: string; oklch: Oklch } {
  const { c, h } = scale.steps[8];
  const light = scale.steps[0].l > 0.5;
  const at = (l: number): Oklch => ({ l, c: Math.min(c, 0.02), h });
  const pass = (l: number) => surfaces.every((i) => contrast(toHex(at(l)), scale.hex[i]) >= BORDER_TARGET);
  let lo = 0.05, hi = 0.99; // light: lo passes, hi fails. dark: reverse roles
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (light ? pass(m) : !pass(m)) lo = m; else hi = m;
  }
  const l = light ? lo : hi;
  return { hex: toHex(at(l)), oklch: at(l) };
}
const BORDER_TARGET = 3.05; // above the 3:1 floor for 8-bit rounding
