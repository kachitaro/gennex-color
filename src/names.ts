import { CORE_HUES } from "./hues";

export interface HueName {
  name: string;
  kind: "core" | "sub";
  /** nearest core hue name (shortest arc) */
  core: string;
  /** signed degrees from that core hue to the angle, in (-180, 180] */
  offset: number;
}
interface Range { name: string; kind: "core" | "sub"; from: number; to: number; ref?: number }

/** A core hue keeps its own name within [hue - 8, hue + 8). */
export const CORE_RADIUS = 8;

/**
 * Sub-names cover only the gaps between core spans. `ref` = hue angle of a real named color
 * (CSS / Radix / Tailwind) used to justify the name; absent = descriptive name, no reference.
 */
const SUBS = [
  { name: "rose", from: 3, to: 17, ref: 16 }, // Tailwind rose-500 16.4
  { name: "coral", from: 33, to: 44, ref: 40 }, // CSS coral 40.2
  { name: "peach", from: 60, to: 72, ref: 64 }, // CSS peachpuff 63.7
  { name: "gold", from: 88, to: 98, ref: 95 }, // CSS gold 95
  { name: "yellow-green", from: 114, to: 125, ref: 127 }, // CSS yellowgreen 127
  { name: "grass", from: 141, to: 148, ref: 147 }, // Radix grass 147
  { name: "jade", from: 164, to: 176, ref: 171 }, // Radix jade 171
  { name: "turquoise", from: 192, to: 206, ref: 192 }, // CSS mediumturquoise 192, darkturquoise 197
  { name: "sky", from: 222, to: 247, ref: 232 }, // CSS deepskyblue 232, Tailwind sky 237
  { name: "indigo", from: 263, to: 284, ref: 277 }, // Tailwind indigo 277 (CSS indigo is a dark 302, not used)
  { name: "purple", from: 300, to: 317, ref: 306 }, // Radix purple 306, Tailwind 304
  { name: "raspberry", from: 333, to: 347 }, // descriptive
] as const;

/** Circular partition, sorted by `from`; the last range ends at `first.from + 360`. */
export const NAME_RANGES: readonly Range[] = [
  ...CORE_HUES.map((c): Range => ({ name: c.name, kind: "core", from: c.hue - CORE_RADIUS, to: c.hue + CORE_RADIUS })),
  ...SUBS.map((s): Range => ({ ...s, kind: "sub" })),
].sort((a, b) => a.from - b.from);

const origin = NAME_RANGES[0].from;
const signedArc = (from: number, to: number) => ((to - from + 540) % 360) - 180;

export function nameOfHue(hue: number): HueName {
  let x = ((hue % 360) + 360) % 360;
  if (x < origin) x += 360;
  const r = NAME_RANGES.find((e) => x >= e.from && x < e.to)!;
  let core: (typeof CORE_HUES)[number] = CORE_HUES[0], best = 361;
  for (const c of CORE_HUES) {
    const d = Math.abs(signedArc(c.hue, x));
    if (d < best) { best = d; core = c; }
  }
  const offset = signedArc(core.hue, x);
  return { name: r.name, kind: r.kind, core: core.name, offset: offset === -180 ? 180 : offset };
}
