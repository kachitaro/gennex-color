// Smoke test of the BUILT output (dist/), not src/. Run: bun run smoke
import { readFileSync } from "node:fs";
import { CORE_HUES, PRESETS, buildTheme, generateScale, nameOfHue, toCss, toDtcg } from "../dist/index.mjs";
import { generateScale as fromSrc } from "../src/scale";
import { toCss as cssFromSrc } from "../src/css";
import { buildTheme as themeFromSrc } from "../src/theme";

const s = generateScale({ hue: 255, mode: "light" });
if (s.hex.length !== 12 || !/^#[0-9a-f]{6}$/.test(s.foreground)) throw new Error("bad shape from dist");
if (JSON.stringify(s) !== JSON.stringify(fromSrc({ hue: 255, mode: "light" }))) throw new Error("dist differs from src");
if (CORE_HUES.length !== 12 || nameOfHue(40).name !== "coral") throw new Error("hues/names missing");

// prebuilt assets must equal what the dist functions generate
for (const [name, opts] of Object.entries(PRESETS)) {
  const css = readFileSync(`dist/css/${name}.css`, "utf8");
  if (css !== toCss(buildTheme(opts)) || css !== cssFromSrc(themeFromSrc(opts))) throw new Error(`dist/css/${name}.css out of sync`);
  const json = JSON.parse(readFileSync(`dist/tokens/${name}.tokens.json`, "utf8"));
  if (JSON.stringify(json) !== JSON.stringify(toDtcg(buildTheme(opts), { description: `gennex-color preset: ${name}` }))) throw new Error(`dist/tokens/${name} out of sync`);
}
console.log("dist smoke ok:", s.hex.join(" "), "| presets", Object.keys(PRESETS).length);
