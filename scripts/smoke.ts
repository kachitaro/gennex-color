// Smoke test of the BUILT output (dist/), not src/. Run: bun run build && bun scripts/smoke.ts
import { CORE_HUES, generateScale } from "../dist/index.mjs";
import { generateScale as fromSrc } from "../src/scale";

const s = generateScale({ hue: 255, mode: "light" });
if (s.hex.length !== 12 || !/^#[0-9a-f]{6}$/.test(s.foreground)) throw new Error("bad shape from dist");
if (JSON.stringify(s) !== JSON.stringify(fromSrc({ hue: 255, mode: "light" }))) throw new Error("dist differs from src");
if (CORE_HUES.length !== 12) throw new Error("CORE_HUES missing");
console.log("dist smoke ok:", s.hex.join(" "), "fg", s.foreground);
