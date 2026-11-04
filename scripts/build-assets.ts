// Writes the prebuilt stylesheets and DTCG token files for every preset. Run after tsdown (it cleans dist/).
import { mkdir } from "node:fs/promises";
import { toCss } from "../src/css";
import { toDtcg } from "../src/dtcg";
import { DEVGLOW_PRESETS } from "../src/devglow";
import { PRESETS } from "../src/presets";
import { buildTheme } from "../src/theme";

await mkdir("dist/css", { recursive: true });
await mkdir("dist/tokens", { recursive: true });
const ALL = { ...PRESETS, ...Object.fromEntries(Object.entries(DEVGLOW_PRESETS).map(([n, o]) => [`devglow-${n}`, o])) };
for (const [name, opts] of Object.entries(ALL)) {
  const theme = buildTheme(opts);
  await Bun.write(`dist/css/${name}.css`, toCss(theme));
  await Bun.write(`dist/tokens/${name}.tokens.json`, JSON.stringify(toDtcg(theme, { description: `gennex-color preset: ${name}` }), null, 2) + "\n");
}
console.log(`wrote ${Object.keys(ALL).length} presets to dist/css and dist/tokens`);
