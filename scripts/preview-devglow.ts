// Writes docs/preview/devglow.html (static): per devglow palette, the original colors next to our preset in dark (neutral
// cap 0.03 vs the proposed dark cap) and light. Run: bun scripts/preview-devglow.ts
import { readFileSync } from "node:fs";
import { dE } from "../test/util";
import { DEVGLOW_DARK_CHROMA_CAP, DEVGLOW_PRESETS, DEVGLOW_TAGLINES, devglowPreset } from "../src/devglow";
import { generateNeutral, type NeutralRamp } from "../src/neutral";
import { TOKEN_NAMES, buildTheme, type TokenMap } from "../src/theme";

const snap = JSON.parse(readFileSync("presets/devglow.snapshot.json", "utf8")) as { source: { sha: string }; palettes: Record<string, { colors: Record<string, string>; tagline: string }> };
const SURF = ["BACKGROUND", "DARK_00", "DARK_01", "DARK_02", "DARK_03"];

/** mean distance from each devglow surface to its nearest step of our dark neutral (steps 1-8) */
const fit = (colors: Record<string, string>, ramp: NeutralRamp) => {
  const N = generateNeutral({ mode: "dark", ramp }).hex.slice(0, 8);
  return SURF.reduce((a, k) => a + Math.min(...N.map((h) => dE(h, colors[k]))), 0) / SURF.length;
};

const panel = (t: TokenMap, label: string) => {
  const vars = TOKEN_NAMES.map((k) => `--${k}:${t[k]}`).join(";");
  return `<div class="p" style="${vars}"><small>${label}</small>
<div class="card"><b>Project settings</b><span class="mu">Muted description text</span>
<div class="row"><span class="in">Input border</span><span class="in ring">Focus ring</span></div>
<div class="row"><span class="b pri">Primary</span><span class="b sec">Secondary</span><span class="b acc">Accent</span><span class="b des">Delete</span></div>
<div class="al">Alert: <i style="color:var(--info-text)">info text</i> · <i style="color:var(--warning-text)">warning text</i> · <i style="color:var(--destructive-text)">error text</i></div></div></div>`;
};
const code = (c: Record<string, string>) => {
  const s = (k: string, x: string, b = false) => `<span style="color:${c[k]}${b ? ";font-weight:700" : ""}">${x}</span>`;
  return `<div class="code" style="background:${c.BACKGROUND};color:${c.FOREGROUND}">
${s("RED", "function")} ${s("GREEN", "greet", true)}(name) { ${s("DARK_04", "// original devglow colors")}
  ${s("RED", "const")} msg ${s("PINK", "=")} ${s("YELLOW", '"hello "')} ${s("PINK", "+")} name;
  ${s("RED", "return")} msg.length ${s("PINK", ">")} ${s("ORANGE", "3")} ? msg : ${s("ORANGE", "null")};
}
<div class="sw">${Object.entries(c).map(([k, v]) => `<i style="background:${v}" title="${k} ${v}"></i>`).join("")}</div></div>`;
};

let rows = "", sum03 = 0, sum06 = 0;
for (const name of Object.keys(snap.palettes)) {
  const colors = snap.palettes[name].colors;
  const o03 = DEVGLOW_PRESETS[name], o06 = devglowPreset(name, { darkChromaCap: DEVGLOW_DARK_CHROMA_CAP });
  const t03 = buildTheme(o03), t06 = buildTheme(o06);
  const f03 = fit(colors, o03.neutral as NeutralRamp), f06 = fit(colors, o06.neutral as NeutralRamp);
  sum03 += f03; sum06 += f06;
  const n = o06.neutral as NeutralRamp;
  rows += `<section><h2>${name} <small>${DEVGLOW_TAGLINES[name]}</small></h2>
<p class="meta">seed hue ${o03.hue}° · κ ${o03.kappa} · neutral ${n.hue}° · step-9 chroma light ${(o03.neutral as NeutralRamp).chroma} · dark <b>0.03 cap:</b> ${(o03.neutral as NeutralRamp).chroma} → page ${t03.dark.background}, fit ΔE ${f03.toFixed(4)} · <b>${DEVGLOW_DARK_CHROMA_CAP} cap:</b> ${n.chromaDark} → page ${t06.dark.background}, fit ΔE ${f06.toFixed(4)} · devglow page ${colors.BACKGROUND}</p>
<div class="g">${code(colors)}${panel(t03.dark, "ours, dark, cap 0.03 (current default)")}${panel(t06.dark, `ours, dark, cap ${DEVGLOW_DARK_CHROMA_CAP} (proposed)`)}${panel(t03.light, "ours, light")}</div></section>`;
}
const N = Object.keys(snap.palettes).length;
const html = `<!doctype html><meta charset="utf-8"><title>gennex-color: devglow presets</title><style>
body{font:13px system-ui;margin:16px;background:#666;color:#eee}h1{margin:0 0 4px}h2{margin:18px 0 2px}h2 small{font-weight:400;opacity:.7}
.meta{margin:0 0 6px;font-size:12px;opacity:.85}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.code{font:12px/1.5 ui-monospace,monospace;white-space:pre;padding:12px;border-radius:8px}.sw{display:flex;margin-top:10px}.sw i{flex:1;height:14px}
.p{background:var(--background);color:var(--foreground);border-radius:8px;padding:10px;border:1px solid var(--border)}.p>small{display:block;opacity:.7;margin-bottom:6px}
.card{background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:7px}
.mu{color:var(--muted-foreground)}.row{display:flex;gap:6px;flex-wrap:wrap}.in{border:1px solid var(--input);border-radius:6px;padding:4px 8px;font-size:12px}.ring{outline:2px solid var(--ring);outline-offset:1px}
.b{padding:4px 9px;border-radius:6px;font-weight:600;font-size:12px}.pri{background:var(--primary);color:var(--primary-foreground)}.sec{background:var(--secondary);color:var(--secondary-foreground)}.acc{background:var(--accent);color:var(--accent-foreground)}.des{background:var(--destructive);color:var(--destructive-foreground)}
.al{background:var(--muted);color:var(--muted-foreground);border-radius:6px;padding:5px 8px;font-size:12px}
</style><h1>devglow presets</h1><p>Palette data: devglow @ ${snap.source.sha.slice(0, 10)} (MIT). Left: devglow's own dark colors. Then our dark with the neutral's step-9 chroma capped at 0.03 (current default) and at ${DEVGLOW_DARK_CHROMA_CAP} (proposed, option <code>darkChromaCap</code>), then our light. "fit ΔE" = mean OKLab distance from devglow's 5 surface colors to the nearest of our 8 dark surface steps (below ~0.02 is not visible). Mean over ${N} palettes: cap 0.03 → ${(sum03 / N).toFixed(4)}, cap ${DEVGLOW_DARK_CHROMA_CAP} → ${(sum06 / N).toFixed(4)}.</p>${rows}`;
await Bun.write("docs/preview/devglow.html", html);
console.log("wrote docs/preview/devglow.html", html.length, "| mean fit", (sum03 / N).toFixed(4), "->", (sum06 / N).toFixed(4));
