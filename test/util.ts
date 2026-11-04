import { converter, inGamut } from "culori";

const toOklab = converter("oklab");
const toOklch = converter("oklch");

function lin(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
/** WCAG 2.x relative luminance of an 8-bit sRGB hex. */
export function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function cr(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function dE(a: string | { l: number; c: number; h: number }, b: string | { l: number; c: number; h: number }) {
  const f = (v: typeof a) => toOklab(typeof v === "string" ? v : { mode: "oklch", ...v });
  const [p, q] = [f(a)!, f(b)!];
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}
export const okl = (hex: string) => { const c = toOklch(hex)!; return { l: c.l, c: c.c, h: c.h ?? 0 }; };
const srgb = inGamut("rgb");
export function maxChroma(l: number, h: number) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (srgb({ mode: "oklch", l, c: m, h })) lo = m; else hi = m;
  }
  return lo;
}
export const inSrgb = (s: { l: number; c: number; h: number }) => srgb({ mode: "oklch", ...s });
export const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
export const seeds = (step: number) => Array.from({ length: Math.round(360 / step) }, (_, i) => i * step);

/** sRGB-space source-over: `top` at opacity `a` over `bottom`, rounded to 8 bits (what a browser paints). */
export function mix(top: string, bottom: string, a: number) {
  const ch = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [t, b] = [ch(top), ch(bottom)];
  return "#" + t.map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
}
