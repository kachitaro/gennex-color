// Type-level check that the emitted .d.mts is usable by a consumer.
import { generateScale, type Scale } from "../dist/index.mjs";
const s: Scale = generateScale({ hue: 10, mode: "dark", kappa: 0.5 });
// @ts-expect-error mode is a union, not string
generateScale({ hue: 10, mode: "sepia" });
export default s.hex[0];
