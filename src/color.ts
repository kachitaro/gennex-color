import { converter, formatHex, inGamut } from "culori";
import type { Oklch } from "./scale";

const srgb = inGamut("rgb");
const inside = (l: number, c: number, h: number) => srgb({ mode: "oklch", l, c, h });

/** Largest chroma still inside sRGB at (l, h). Gamut mapping keeps L and h (L decides contrast). */
export function maxChroma(l: number, h: number): number {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (inside(l, m, h)) lo = m; else hi = m;
  }
  return lo;
}

export const toHex = (c: Oklch) => formatHex({ mode: "oklch", ...c });

function lin(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
/** WCAG 2.x contrast on 8-bit sRGB hex (what ships, so rounding is included). */
export function contrast(a: string, b: string): number {
  const y = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const [p, q] = [y(a), y(b)];
  return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05);
}

const toLrgb = converter("lrgb");
/** Relative luminance (continuous, unrounded). */
export function luminance(c: Oklch): number {
  const x = toLrgb({ mode: "oklch", ...c })!;
  return 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b;
}

const toOklab = converter("oklab");
/** Euclidean distance in OKLab between two hex colors. */
export function deltaE(a: string, b: string): number {
  const [p, q] = [toOklab(a)!, toOklab(b)!];
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

/** sRGB-space source-over: `top` at opacity `a` over `bottom`, rounded to 8 bits (what a browser paints). */
export function mixHex(top: string, bottom: string, a: number): string {
  const ch = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [t, b] = [ch(top), ch(bottom)];
  return "#" + t.map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
}
