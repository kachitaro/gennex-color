import { contrast, luminance, maxChroma, toHex } from "./color";

export type Mode = "light" | "dark";
export interface Oklch { l: number; c: number; h: number }
export interface Scale {
  /** steps[0] is step 1 ... steps[11] is step 12 */
  steps: Oklch[];
  /** sRGB hex of each step, same indexing */
  hex: string[];
  /** foreground for steps 9 and 10 */
  foreground: string;
}
export interface ScaleOptions { hue: number; mode: Mode; kappa?: number }

// Median of 25 Radix 3.0.0 scales (SPEC §4.2). Steps 1-8 only; 9-12 are solved.
const L = { light: [0.994, 0.982, 0.959, 0.932, 0.9, 0.859, 0.806, 0.734], dark: [0.188, 0.211, 0.267, 0.309, 0.345, 0.389, 0.452, 0.537] };
const CR = { light: [0.02, 0.07, 0.16, 0.26, 0.36, 0.48, 0.63, 0.75], dark: [0.09, 0.13, 0.31, 0.46, 0.5, 0.53, 0.59, 0.72] };

// (hue, L9) anchors at the 12 core hues, interpolated with smoothstep around the circle.
const ANCHORS: [number, number][] = [[25, 0.565], [52, 0.7], [80, 0.8], [106, 0.87], [133, 0.83], [156, 0.72], [184, 0.72], [214, 0.74], [255, 0.535], [292, 0.55], [325, 0.565], [355, 0.565]];
function anchorL(h: number) {
  const n = ANCHORS.length;
  const hh = h < ANCHORS[0][0] ? h + 360 : h;
  for (let i = 0; i < n; i++) {
    const [ha, la] = ANCHORS[i];
    let [hb, lb] = ANCHORS[(i + 1) % n];
    if (hb < ha) hb += 360;
    if (hh >= ha && hh <= hb) {
      const t = (hh - ha) / (hb - ha);
      return la + (lb - la) * t * t * (3 - 2 * t);
    }
  }
  return ANCHORS[0][1];
}
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const ok = (l: number, c: number, h: number): Oklch => ({ l, c, h });

// Luminance where pure white and pure black give equal contrast: (Y+0.05)^2 = 0.05*1.05, ~4.58:1 both ways.
// Below it white text works, above it black works, so the hover step (L10) must move AWAY from it.
const Y_PIVOT = Math.sqrt(0.05 * 1.05) - 0.05;
/** L at which a kappa-scaled color of this hue sits on the pivot luminance. */
function pivotL(h: number, kappa: number) {
  let lo = 0.3, hi = 0.95;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    luminance(ok(m, kappa * maxChroma(m, h), h)) < Y_PIVOT ? (lo = m) : (hi = m);
  }
  return lo;
}

const T11 = 4.55, T12 = 7.1, TFG = 4.55; // solve a hair above the 4.5 / 7 test floors (8-bit rounding)

export function generateScale({ hue, mode, kappa = 0.85 }: ScaleOptions): Scale {
  const h = ((hue % 360) + 360) % 360;
  const dark = mode === "dark";
  const L9 = anchorL(h);
  const C9 = kappa * maxChroma(L9, h);
  // delta is 0 at the pivot, so hover direction flips continuously with the seed (A5); shrinks inside +-0.04 L of it.
  const L10 = L9 + (-0.03 + 0.06 * smooth((L9 - pivotL(h, kappa)) / 0.08 + 0.5));
  const steps: Oklch[] = [];
  for (let i = 0; i < 8; i++) steps.push(ok(L[mode][i], Math.min(CR[mode][i] * C9, 0.98 * maxChroma(L[mode][i], h)), h));
  steps.push(ok(L9, C9, h));
  steps.push(ok(L10, Math.min(C9 * 0.99, 0.98 * maxChroma(L10, h)), h));
  const bgs = [toHex(steps[0]), toHex(steps[1]), toHex(steps[2])];
  const solveText = (start: number, target: number, ratio: number) => {
    let l = start;
    for (let i = 0; i < 200; i++) {
      const c = ok(l, Math.min(ratio * C9, 0.98 * maxChroma(l, h)), h);
      const x = toHex(c);
      if (bgs.every((b) => contrast(x, b) >= target)) return c;
      l += (dark ? 1 : -1) * 0.003;
    }
    return ok(l, 0, h);
  };
  steps.push(solveText(dark ? 0.785 : 0.544, T11, dark ? 0.82 : 0.9));
  steps.push(solveText(dark ? 0.911 : 0.332, T12, dark ? 0.29 : 0.45));
  const hex = steps.map(toHex);
  return { steps, hex, foreground: pickForeground(hex[8], hex[9], h) };
}

/** Prefer hue-tinted light/dark, fall back to pure white/black. Must pass on BOTH step 9 and 10. */
function pickForeground(s9: string, s10: string, h: number): string {
  const cands: [string, boolean][] = [[toHex(ok(0.985, 0.012, h)), true], [toHex(ok(0.2, 0.03, h)), true], ["#ffffff", false], ["#000000", false]];
  const scored = cands.map(([x, tint]) => ({ x, tint, cr: Math.min(contrast(x, s9), contrast(x, s10)) }));
  const pass = scored.filter((s) => s.cr >= TFG).sort((a, b) => Number(b.tint) - Number(a.tint) || b.cr - a.cr);
  return (pass[0] ?? scored.sort((a, b) => b.cr - a.cr)[0]).x;
}
