// Type-level check that the emitted .d.mts is usable by a consumer.
import { buildTheme, generateScale, toCss, toDtcg, type Scale, type Theme } from "../dist/index.mjs";
const s: Scale = generateScale({ hue: 10, mode: "dark", kappa: 0.5 });
const t: Theme = buildTheme({ hue: 40, neutral: "warm", pageStep: 2 });
const css: string = toCss(t, { radius: "0.5rem" });
const j = toDtcg(t);
// @ts-expect-error mode is a union, not string
generateScale({ hue: 10, mode: "sepia" });
// @ts-expect-error pageStep is 1 | 2
buildTheme({ hue: 10, pageStep: 3 });
export default [s.hex[0], css.length, j.$description];
