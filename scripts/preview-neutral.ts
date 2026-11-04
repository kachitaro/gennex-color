// Regenerates docs/preview/neutral.html (static). Run: bun scripts/preview-neutral.ts
import { contrast } from "../src/color";
import { generateNeutral, autoRamp, neutralAlpha, type NeutralRamp, type NeutralRampName } from "../src/neutral";
import { generateScale, type Mode } from "../src/scale";

const HUES = [{ name: "blue", hue: 255 }, { name: "green", hue: 156 }, { name: "orange", hue: 52 }, { name: "violet", hue: 292 }];
const f1 = (n: number) => n.toFixed(1);
const ink = (bg: string) => (contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000" : "#fff");

function strip(hex: string[]) {
  return `<div class="strip">${hex.map((c, i) => `<i style="background:${c};color:${ink(c)}">${i + 1}</i>`).join("")}</div>`;
}
function alphaStrip(n: ReturnType<typeof generateNeutral>, bg: string) {
  const a = neutralAlpha(n);
  return `<div class="strip" style="background:${bg}">${a.map((p, i) => `<i style="background:${p.css};color:${ink(n.hex[i])}" title="${p.css}">a${i + 1}<small>${p.alpha}</small></i>`).join("")}</div>`;
}

function card(ramp: NeutralRampName | NeutralRamp, hue: number, mode: Mode, hueName: string) {
  const n = generateNeutral({ ramp, mode }).hex;
  const s = generateScale({ hue, mode });
  const page = n[0], surface = mode === "dark" ? n[1] : n[0]; // SPEC 3.3: card = N1 light, N2 dark
  const a = neutralAlpha(generateNeutral({ ramp, mode }));
  const muted = `${f1(contrast(n[10], surface))}:1`, input = `${f1(contrast(n[8], surface))}:1`;
  const btn = (bg: string, fg: string, label: string, border = "transparent") => `<span class="b" style="background:${bg};color:${fg};border:1px solid ${border}">${label}</span>`;
  return `<div class="pg" style="background:${page};color:${n[11]}"><div class="cd" style="background:${surface};border:1px solid ${n[5]}">
<b style="color:${n[11]}">Project ${hueName}</b>
<div style="color:${n[10]}">Muted description · ${muted}</div>
<div class="in" style="border:1px solid ${n[8]};color:${n[11]}">Input · border ${input}</div>
<div class="rw">${btn(s.hex[8], s.foreground, "Primary")}${btn(s.hex[9], s.foreground, "Hover")}${btn(n[2], n[11], "Secondary")}${btn(n[3], n[11], "Accent", n[5])}</div>
<div class="rw"><span class="b" style="background:${s.hex[2]};color:${s.hex[10]}">Badge ${f1(contrast(s.hex[10], s.hex[2]))}:1</span>
<span class="b" style="background-color:${surface};background-image:linear-gradient(${a[2].css},${a[2].css});color:${n[11]}">a3</span>
<span class="b" style="background-color:${surface};background-image:linear-gradient(${a[5].css},${a[5].css});color:${n[11]}">a6</span>
<span class="b" style="background-color:${surface};background-image:linear-gradient(${a[8].css},${a[8].css});color:${ink(n[8])}">a9</span></div>
</div></div>`;
}

const RAMPS: { label: string; ramp: (hue: number) => NeutralRampName | NeutralRamp; note: string }[] = [
  { label: "cool (255°, C 0.016)", ramp: () => "cool", note: "fixed" },
  { label: "neutral (C 0)", ramp: () => "neutral", note: "fixed" },
  { label: "warm (70°, C 0.012)", ramp: () => "warm", note: "fixed" },
  { label: "auto (follows each card's hue, C 0.016)", ramp: (h) => autoRamp(h), note: "per card" },
];

let body = "";
for (const r of RAMPS) {
  body += `<section><h2>${r.label}</h2>`;
  if (r.note === "fixed") {
    for (const mode of ["light", "dark"] as Mode[]) {
      const n = generateNeutral({ ramp: r.ramp(0), mode });
      body += `<div class="sw ${mode}"><span>${mode}</span>${strip(n.hex)}${alphaStrip(n, n.hex[0])}</div>`;
    }
  } else {
    for (const mode of ["light", "dark"] as Mode[]) for (const h of HUES) {
      const n = generateNeutral({ ramp: autoRamp(h.hue), mode });
      body += `<div class="sw ${mode}"><span>${mode} ${h.name}</span>${strip(n.hex)}</div>`;
    }
  }
  body += `<div class="cols">${HUES.map((h) => `<div>${(["light", "dark"] as Mode[]).map((m) => card(r.ramp(h.hue), h.hue, m, h.name)).join("")}</div>`).join("")}</div></section>`;
}

const html = `<!doctype html><meta charset="utf-8"><title>gennex-color: neutral preview</title><style>
body{font:13px system-ui;margin:16px;background:#777}h1{color:#fff}section{background:#aaa;padding:12px;margin-bottom:16px;border-radius:6px}h2{margin:0 0 8px}
.sw{display:grid;grid-template-columns:90px 1fr 1fr;gap:6px;align-items:center;margin:3px 0}.sw span{font-size:12px}
.strip{display:flex}.strip i{flex:1;height:34px;font:600 10px monospace;font-style:normal;padding:2px}.strip i small{display:block;font:9px monospace;opacity:.8}
.cols{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.pg{padding:12px;border-radius:6px;margin-bottom:6px}
.cd{padding:12px;border-radius:8px;display:flex;flex-direction:column;gap:8px}.in{padding:6px 8px;border-radius:6px}.rw{display:flex;gap:6px;flex-wrap:wrap}.b{padding:5px 9px;border-radius:6px;font-weight:600;font-size:12px}
</style><h1>gennex-color: neutral ramps as UI surfaces</h1>
<p style="color:#fff">Each card: page = step 1, card = step 1 (light) / step 2 (dark), text = s12, muted = s11 (ratio shown), input border = s9 (ratio shown), secondary = s3, accent = s4 with s6 border, badge = hue s3/s11. Buttons use the core hue's solid + hover. a3/a6/a9 = translucent neutral overlays on the card (alpha from neutralAlpha over step 1). Auto row: the neutral follows each card's own hue.</p>${body}`;
await Bun.write("docs/preview/neutral.html", html);
console.log("wrote docs/preview/neutral.html", html.length);
