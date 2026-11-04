// Regenerates docs/preview/index.html from src/ (static, no runtime deps). Run: bun scripts/preview.ts
import * as R from "@radix-ui/colors";
import { contrast } from "../src/color";
import { CORE_HUES } from "../src/hues";
import { generateScale, type Mode } from "../src/scale";

const ink = (bg: string) => (contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000" : "#fff");
const f2 = (n: number) => n.toFixed(2);
const radix = (name: string, mode: Mode) => Array.from({ length: 12 }, (_, i) => (R as any)[name + (mode === "dark" ? "Dark" : "")][name + (i + 1)] as string);

const strip = (hex: string[], label: string, big = false) =>
  `<div class="strip${big ? " big" : ""}"><span>${label}</span>${hex.map((c, i) => `<i style="background:${c};color:${ink(c)}">${i + 1}${big ? `<small>${c}</small>` : ""}</i>`).join("")}</div>`;
const btn = (bg: string, fg: string, label: string) => {
  const r = contrast(fg, bg);
  return `<div class="btn" style="background:${bg};color:${fg}"><b>${label}</b><small>${f2(r)}:1 ${r >= 4.5 ? "AA" : "FAIL"}</small></div>`;
};

let body = "";
for (const mode of ["light", "dark"] as Mode[]) {
  body += `<section class="${mode === "dark" ? "dk" : "lt"}"><h2>${mode}: 12 core hues, 12 steps, solid + hover</h2>`;
  for (const { name, hue } of CORE_HUES) {
    const s = generateScale({ hue, mode });
    body += `<div class="row"><div class="nm">${name}<small>${hue}°</small></div><div class="col">${strip(s.hex, "1–12")}</div><div class="btns">${btn(s.hex[8], s.foreground, "s9")}${btn(s.hex[9], s.foreground, "s10 hover")}</div></div>`;
  }
  body += "</section>";
}

body += `<h1>O2: step 11–12 of yellow / amber (olive check)</h1><p>Large samples on steps 1, 2, 3. "ours" = generator at the Radix hue; "Radix" = @radix-ui/colors 3.0.0. h = OKLCH hue of step 11 / 12 (a brown reads as h dropping toward ~60–70°; olive stays ≥ ~90°).</p>`;
for (const mode of ["light", "dark"] as Mode[]) {
  for (const name of ["amber", "yellow"]) {
    const rad = radix(name, mode);
    const ours = generateScale({ hue: CORE_HUES.find((c) => c.name === name)!.hue, mode });
    const sample = (hex: string[], who: string) => {
      const hs = [10, 11].map((i) => hex[i]);
      return `<div class="o2row">${[0, 1, 2].map((b) => `<div class="o2" style="background:${hex[b]}"><span style="color:${hex[10]}">Step 11 · The quick brown fox</span><span style="color:${hex[11]}">Step 12 · The quick brown fox</span><small style="color:${hex[11]}">on step ${b + 1} · s11 ${f2(contrast(hex[10], hex[b]))}:1 · s12 ${f2(contrast(hex[11], hex[b]))}:1</small></div>`).join("")}<code>${who} s11 ${hs[0]} s12 ${hs[1]}</code></div>`;
    };
    body += `<section class="${mode === "dark" ? "dk" : "lt"}"><h2>${name} · ${mode}</h2>${strip(ours.hex, "ours", true)}${sample(ours.hex, "ours")}${strip(rad, "Radix", true)}${sample(rad, "Radix")}</section>`;
  }
}

const html = `<!doctype html><meta charset="utf-8"><title>gennex-color: scale preview</title><style>
body{font:14px system-ui;margin:16px;background:#777;color:#111}h1,h2{margin:18px 0 8px}h1{color:#fff}
section{padding:12px;margin-bottom:14px;border-radius:6px}.lt{background:#fdfdfd;color:#111}.dk{background:#151515;color:#eee}
.row{display:grid;grid-template-columns:90px 1fr 300px;gap:10px;align-items:center;margin:4px 0}.nm small{display:block;opacity:.6}
.strip{display:flex;align-items:stretch}.strip span{width:52px;font-size:12px;align-self:center;opacity:.7}
.strip i{flex:1;height:34px;font:600 11px monospace;font-style:normal;padding:3px}.strip.big i{height:64px}.strip i small{display:block;font:10px monospace;opacity:.85}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}.btn{padding:8px 10px;border-radius:6px;display:flex;flex-direction:column}.btn small{opacity:.95}
.o2row{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:2px 0 14px}.o2{padding:14px;display:flex;flex-direction:column;gap:6px;font-size:22px}.o2 small{font-size:11px;font-family:monospace}
.o2row code{grid-column:1/-1;font-size:11px;opacity:.7;padding:4px 0}</style>
<h1>gennex-color: scale generator preview</h1><p style="color:#fff">Generated from src/scale.ts (sRGB, κ=0.85). s9 = solid, s10 = hover, text = tinted/pure foreground chosen per hue; ratios are WCAG 2.x on the shipped 8-bit hex.</p>
${body}`;
await Bun.write("docs/preview/index.html", html);
console.log("wrote docs/preview/index.html", html.length);
