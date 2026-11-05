import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postcss from "postcss";
import { ApplyError, applyTheme, readMarker } from "../src/css-apply";
import { toOklchCss } from "../src/css";
import { SHADCN_TOKENS } from "../src/registry";
import { TOKEN_NAMES, buildTheme } from "../src/theme";

const THEME = buildTheme({ hue: 40, neutral: "warm" });
const THEME_B = buildTheme({ hue: 217, neutral: "cool", primaryMode: "vivid" });
const MARK = "gennex-color 9.9.9 · aTESTCODE";
const fx = (n: string) => readFileSync(`test/fixtures/css/${n}`, "utf8");
const FIXTURES: Record<string, string> = {
  "shadcn init nova-indigo": fx("shadcn-init-nova-indigo.css"),
  "shadcn init default": fx("shadcn-init-default.css"),
  "A: :root in @layer base (tabs, tricky comment/strings)": fx("case-A-layer-base.css"),
  "B: two :root, minified": fx("case-B-two-roots-minified.css"),
  "C: CRLF + BOM": fx("case-C-crlf-bom.css"),
  "empty": "",
  "only @import": '@import "tailwindcss";\n',
  "no :root": '@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));\n.a { color: red; }\n',
  "no .dark": '@import "tailwindcss";\n:root {\n  --background: oklch(1 0 0);\n  --radius: 0.5rem;\n}\n',
  "no @theme inline": '@import "tailwindcss";\n:root {\n    --background: oklch(1 0 0);\n}\n.dark {\n    --background: oklch(0.1 0 0);\n}\n',
  "no sidebar/chart, 4 spaces": '@import "tailwindcss";\n@theme inline {\n    --color-background: var(--background);\n}\n:root {\n    --background: #fff;\n    --foreground: #000;\n}\n.dark {\n    --background: #000;\n}\n',
  ":root, :host and html.dark": '@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));\n:root, :host {\n  --background: #fff;\n}\nhtml.dark {\n  --background: #000;\n}\n',
  "no trailing newline, single quotes": "@import 'tailwindcss';\n:root{--background:#fff}",
};
const OWN = new Set<string>(TOKEN_NAMES);
const apply = (css: string, t = THEME, o = {}) => applyTheme(css, t, { marker: MARK, ...o });

// ---- independent checker (postcss, not the editor's own code): the CSS minus everything the tool owns --------------------
const isOwnedDecl = (n: postcss.ChildNode) => n.type === "decl" && n.prop.startsWith("--") && OWN.has(n.prop.replace(/^--(color-)?/, ""));
const isMarker = (n: postcss.ChildNode) => n.type === "comment" && /gennex-color/.test(n.text);
/** Every node that is not ours, in order, with its raws. A container holding only our declarations is invisible (the tool may append or fill those). */
function skeleton(css: string): string[] {
  const out: string[] = [];
  const visit = (n: postcss.ChildNode, where: string) => {
    if (isOwnedDecl(n) || isMarker(n)) return;
    if ((n.type === "rule" || n.type === "atrule") && n.nodes && n.nodes.length > 0 && n.nodes.every((c) => isOwnedDecl(c) || isMarker(c))) return;
    const raws = n.raws as { before?: string; between?: string };
    const label = n.type === "rule" ? n.selector : n.type === "atrule" ? `${n.name} ${n.params}` : n.type === "decl" ? `${n.prop}:${n.value}` : n.type === "comment" ? n.text : "";
    out.push(`${where}|${n.type}|${label}|${JSON.stringify([raws.before ?? "", raws.between ?? ""])}`);
    if ("nodes" in n && n.nodes) for (const c of n.nodes) visit(c, `${where}>${label}`);
  };
  for (const n of postcss.parse(css.replace(/^\uFEFF/, "")).nodes) visit(n, "");
  return out;
}

describe("what gets written", () => {
  for (const [name, css] of Object.entries(FIXTURES)) {
    test(`${name}: every owned variable has the theme's value in the right mode`, () => {
      const r = apply(css);
      const root = postcss.parse(r.text.replace(/^\uFEFF/, ""));
      const seen = { light: new Map<string, string>(), dark: new Map<string, string>() };
      root.walkRules((rule) => {
        const sel = rule.selectors.map((s) => s.trim());
        const mode = sel.every((s) => s === ":root" || s === ":host") ? "light" : sel.every((s) => /^(html|:root)?\.dark$/.test(s)) ? "dark" : undefined;
        if (mode) rule.walkDecls(/^--/, (d) => { if (OWN.has(d.prop.slice(2))) seen[mode].set(d.prop.slice(2), d.value); });
      });
      for (const m of ["light", "dark"] as const) for (const k of TOKEN_NAMES) expect([name, m, k, seen[m].get(k)]).toEqual([name, m, k, toOklchCss(THEME[m][k])]);
      expect(r.changed).toBe(true);
      expect(r.findings.filter((f) => f.code !== "W4")).toEqual([]); // (case B has a --color-primary pointing elsewhere)
    });
    test(`${name}: nothing outside the owned declarations changes (independent skeleton check)`, () => {
      const r = apply(css);
      expect(skeleton(r.text)).toEqual(skeleton(css));
    });
    test(`${name}: idempotent; applying A then B equals applying B; the result parses`, () => {
      const a = apply(css), again = apply(a.text);
      expect(again.changed).toBe(false);
      expect(again.text).toBe(a.text);
      expect(apply(a.text, THEME_B).text).toBe(apply(css, THEME_B).text);
      expect(() => postcss.parse(a.text.replace(/^\uFEFF/, ""))).not.toThrow();
    });
  }
  test("a full tool-written file keeps the stats honest: all updated on a second theme, none inserted", () => {
    const a = apply(FIXTURES["shadcn init default"]);
    const b = apply(a.text, THEME_B);
    expect(b.stats.inserted).toBe(0);
    expect(b.stats.updated).toBeGreaterThan(50); // status colors are the same in both themes
    expect(apply(a.text, THEME).stats).toEqual({ updated: 0, inserted: 0, mapped: 0, blocks: 0 });
  });
});

describe("the same variable in several rules", () => {
  test("EVERY declaration of a token in :root / .dark rules gets the value (not just the first or the last)", () => {
    const css = '@import "tailwindcss";\n:root { --primary: #111; --ring: #222; }\n.x { a: b; }\n:root { --primary: #333; }\n.dark { --primary: #444; }\n.dark { --primary: #555; }\n';
    const r = apply(css).text;
    const vals = (sel: string) => [...r.matchAll(new RegExp(`${sel.replace(".", "\\.")} \\{[^}]*?--primary: ([^;]+);`, "g"))].map((m) => m[1]);
    expect(vals(":root")).toEqual([toOklchCss(THEME.light.primary), toOklchCss(THEME.light.primary)]);
    expect(vals(".dark")).toEqual([toOklchCss(THEME.dark.primary), toOklchCss(THEME.dark.primary)]);
    expect(r).not.toMatch(/#(111|333|444|555)/);
  });
});

describe("styles are kept", () => {
  test("shadcn init file: --radius, fonts, @layer base, imports are byte-identical; ours added in the file's 4-space style", () => {
    const css = FIXTURES["shadcn init default"], r = apply(css).text;
    for (const line of css.split("\n").filter((l) => /--radius|--font|@layer base|@import|@apply/.test(l))) expect(r).toContain(line);
    expect(r).not.toContain("\t");
    expect(r).toMatch(/\n {4}--primary-text: oklch\(/);
  });
  test("case A (tabs, layered): tabs kept, the tricky comment, strings, lookalike names and unrelated rules untouched", () => {
    const r = apply(FIXTURES["A: :root in @layer base (tabs, tricky comment/strings)"]).text;
    for (const keep of ["/* brand --primary: red; } */", '--my-x: "a;b}";', "--sidebar-width: 16rem;", "--primary-brand: blue;", ".btn { color: var(--primary); }", "--font-sans: Inter;"]) expect(r).toContain(keep);
    expect(r).toMatch(/\n\t\t--primary: oklch\(/);
    expect(r).toMatch(/\n\t--color-ring: var\(--ring\);/);
    expect(r).not.toMatch(/\n {2}--/);
  });
  test("case B (two :root, minified): both :root rules updated (the second one used to win with #000), the user's --x kept, still one line", () => {
    const css = FIXTURES["B: two :root, minified"], r = apply(css).text;
    expect(r).not.toContain("#000;--ring");
    expect(r).toContain("--x:1");
    expect(r).toContain(".foo{a:b}");
    expect(r.match(/:root\{/g)!.length).toBe(2);
    expect(r).toMatch(/--primary:oklch\([^)]*\);--ring:oklch/);
  });
  test("case C (CRLF + BOM): BOM kept, every line break is CRLF, nothing but CRLF added", () => {
    const css = FIXTURES["C: CRLF + BOM"], r = apply(css).text;
    expect(r.startsWith("\uFEFF")).toBe(true);
    expect(r.match(/(?<!\r)\n/g) ?? []).toEqual([]);
    expect(r.match(/\r\n/g)!.length).toBeGreaterThan(css.match(/\r\n/g)!.length);
  });
  test("lookalike names are never touched; --radius and --font-* neither", () => {
    const css = '@import "tailwindcss";\n:root {\n  --primary-brand: 1;\n  --color-primary-brand: 2;\n  --sidebar-width: 3;\n  --chart-foo: 4;\n  --radius: 0.5rem;\n  --font-sans: X;\n  --primary: red;\n}\n';
    const r = apply(css).text;
    for (const l of ["--primary-brand: 1;", "--color-primary-brand: 2;", "--sidebar-width: 3;", "--chart-foo: 4;", "--radius: 0.5rem;", "--font-sans: X;"]) expect(r).toContain(l);
    expect(r).not.toContain("--primary: red;");
  });
  test("--tokens shadcn writes only the 31 shadcn names", () => {
    const r = apply(FIXTURES["no :root"], THEME, { tokens: "shadcn" }).text;
    const names = new Set([...r.matchAll(/^\s+--([\w-]+): /gm)].map((m) => m[1].replace(/^color-/, "")));
    expect([...names].sort()).toEqual([...SHADCN_TOKENS].sort());
  });
  test("the marker: added once at the top of the first :root, replaced (not duplicated) on re-apply, omitted with marker null", () => {
    const a = apply(FIXTURES["shadcn init default"]).text;
    expect(a.match(/gennex-color 9\.9\.9/g)!.length).toBe(1);
    expect(readMarker(a)).toEqual({ version: "9.9.9", code: "aTESTCODE" });
    const b = applyTheme(a, THEME, { marker: "gennex-color 9.9.10 · aOTHER" }).text;
    expect(b.match(/gennex-color/g)!.length).toBe(1);
    expect(readMarker(b)).toEqual({ version: "9.9.10", code: "aOTHER" });
    expect(readMarker(applyTheme(FIXTURES["no :root"], THEME, { marker: null }).text)).toBeUndefined();
  });
});

describe("refusing and conflicts", () => {
  test("Tailwind v3 (@tailwind directives, hsl triplets) and unbalanced CSS are refused with the right exit code", () => {
    const e = (css: string) => { try { apply(css); } catch (x) { return x as ApplyError; } };
    expect(e("@tailwind base;\n:root{--background:0 0% 100%}")?.exit).toBe(3);
    expect(e('@import "tailwindcss";\n:root{--background: 0 0% 100%;}')?.exit).toBe(3);
    expect(e(":root{--background:#fff")?.exit).toBe(2);
    expect(e("a{{{")).toBeInstanceOf(ApplyError);
  });
  test("our prebuilt stylesheet already imported: refused (3) unless forced", () => {
    const css = '@import "tailwindcss";\n@import "gennex-color/css/blue.css";\n';
    expect(() => apply(css)).toThrow(ApplyError);
    const r = apply(css, THEME, { force: true });
    expect(r.findings.map((f) => f.code)).toContain("W5");
  });
  test("W4: --color-primary pointing elsewhere is skipped and reported; --force overwrites it", () => {
    const css = '@import "tailwindcss";\n@theme inline {\n  --color-primary: var(--brand);\n}\n:root { --primary: red; }\n';
    const r = apply(css);
    expect(r.text).toContain("--color-primary: var(--brand);");
    const f = r.findings.find((x) => x.code === "W4")!;
    expect([f.token, f.line]).toEqual(["primary", 3]);
    expect(apply(css, THEME, { force: true }).text).toContain("--color-primary: var(--primary);");
    expect(apply('@import "tailwindcss";\n@theme {\n  --color-primary: var(--primary);\n}\n').findings.filter((x) => x.code === "W4")).toEqual([]);
  });
});

// ---- "can our colors lose?": every warning is a real override, and every real override is a warning ---------------------
const chrome = spawnSync("which", ["google-chrome"]).status === 0;
function effective(css: string, html: { class?: string; attrs?: Record<string, string> } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gx-eff-"));
  const file = join(dir, "p.html");
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css.replace(/^\uFEFF/, "")}</style><body><pre id="o"></pre><script>
const T=${JSON.stringify(TOKEN_NAMES)};const r=document.documentElement;
${html.class ? `r.classList.add(${JSON.stringify(html.class)});` : ""}${Object.entries(html.attrs ?? {}).map(([k, v]) => `r.setAttribute(${JSON.stringify(k)},${JSON.stringify(v)});`).join("")}
const g=()=>{const s=getComputedStyle(document.body);return Object.fromEntries(T.map(k=>[k,s.getPropertyValue('--'+k).trim()]))};
const L=g();r.classList.add('dark');const D=g();document.getElementById('o').textContent=JSON.stringify({light:L,dark:D});</script>`);
  const out = spawnSync("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=1500", "--dump-dom", `file://${file}`], { encoding: "utf8", timeout: 30000 }).stdout;
  const m = out.match(/<pre id="o">([\s\S]*?)<\/pre>/);
  return JSON.parse(m![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as { light: Record<string, string>; dark: Record<string, string> };
}
const BASE = '@import "tailwindcss";\n:root {\n  --background: #fff;\n  --primary: #000;\n}\n.dark {\n  --background: #000;\n}\n';
const CASES: [string, string, { class?: string; attrs?: Record<string, string> }, string[]][] = [
  // name, css, html element setup, tokens (light) that are expected to be overridden by something we cannot edit
  ["clean shadcn-like file", FIXTURES["shadcn init default"], {}, []],
  ["case A (layer base)", FIXTURES["A: :root in @layer base (tabs, tricky comment/strings)"], {}, []],
  ["case B (two :root, minified)", FIXTURES["B: two :root, minified"], {}, []],
  ["case C (CRLF + BOM)", FIXTURES["C: CRLF + BOM"], {}, []],
  ["W1 html:root (more specific) overrides", BASE + "html:root { --primary: red; }\n", {}, ["primary"]],
  ["W1 :root.x with the class on <html>", BASE + ":root.theme-x { --primary: red; }\n", { class: "theme-x" }, ["primary"]],
  ["W1 :root.x without the class: no effect, still reported only if it could win", BASE + ":root.nothing-uses-this { --primary: red; }\n", {}, []],
  ["W2 later class rule on <html>", BASE + ".theme-x { --primary: red; }\n", { class: "theme-x" }, ["primary"]],
  ["W2 [data-theme] later", BASE + "[data-theme=x] { --primary: red; }\n", { attrs: { "data-theme": "x" } }, ["primary"]],
  ["W2 body (children inherit from the nearest ancestor)", BASE + "body { --primary: red; }\n", {}, ["primary"]],
  ["W1/W2 inside @media", BASE + "@media all { :root { --primary: red; } }\n", {}, ["primary"]],
  ["no warning: the same class rule BEFORE ours loses to ours", ".theme-x { --primary: red; }\n" + BASE, { class: "theme-x" }, []],
  ["no warning: html (lower specificity) loses to :root", BASE + "html { --primary: red; }\n", {}, []],
  ["W3 unlayered rule beats our @layer base :root", '@import "tailwindcss";\n@layer base {\n  :root { --primary: #000; }\n}\nhtml { --primary: red; }\n', {}, ["primary"]],
];
describe.skipIf(!chrome)("effective colors in a real browser: warning <=> color can lose", () => {
  for (const [name, css, html, expectLose] of CASES) {
    test(name, () => {
      const r = apply(css);
      const eff = effective(r.text, html);
      const lost = { light: TOKEN_NAMES.filter((k) => eff.light[k] !== toOklchCss(THEME.light[k])), dark: TOKEN_NAMES.filter((k) => eff.dark[k] !== toOklchCss(THEME.dark[k])) };
      const lostAny = [...new Set([...lost.light, ...lost.dark])].sort();
      // 1) every color that really loses has a warning for that token
      const warned = new Set(r.findings.map((f) => f.token));
      for (const k of lostAny) expect([name, k, warned.has(k)]).toEqual([name, k, true]);
      expect([name, lostAny]).toEqual([name, [...expectLose].sort()]);
      // 2) nothing to report when nothing can lose
      if (expectLose.length === 0 && !name.startsWith("W1 :root.x without")) expect([name, r.findings.filter((f) => f.code !== "W4")]).toEqual([name, []]);
      // 3) findings carry code, token and a line of the ORIGINAL file
      for (const f of r.findings) { expect(f.code).toMatch(/^W[1-5]$/); expect(f.line).toBeGreaterThan(0); expect(f.selector ?? f.token).toBeDefined(); }
    }, 40000);
  }
});

describe("findings carry the right code", () => {
  const codes = (css: string) => apply(css).findings.map((f) => f.code);
  test("root-like rule we cannot edit => W1; other page-level rule => W2; layer shadowing => W3", () => {
    expect(codes(BASE + "html:root { --primary: red; }\n")).toContain("W1");
    expect(codes(BASE + "body { --primary: red; }\n")).toContain("W2");
    expect(codes(BASE + ".theme-x { --primary: red; }\n")).toContain("W2");
    expect(codes('@layer base {\n  :root { --primary: #000; }\n}\nhtml { --primary: red; }\n')).toContain("W3");
  });
  test("local component scopes are not page-level and stay silent", () => {
    expect(codes(BASE + ".sidebar .item { --primary: red; }\n")).toEqual([]);
  });
});

// ---- fuzz: real stylesheets + injected owned blocks + truncation: either a correct splice or a clean refusal ---------------
describe("fuzz: preservation", () => {
  const nm = "examples/vite-app/node_modules";
  const corpus: [string, string][] = Object.entries(FIXTURES).map(([k, v]) => [k, v]);
  for (const f of ["tailwindcss/index.css", "tailwindcss/preflight.css", "tailwindcss/theme.css", "tailwindcss/utilities.css", "shadcn/dist/tailwind.css", "tw-animate-css/dist/tw-animate.css"]) {
    try { corpus.push([f, readFileSync(`${nm}/${f}`, "utf8")]); } catch { /* corpus file not installed: skip */ }
  }
  let seed = 12345;
  const rnd = (n: number) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  const BLOCKS = [":root{--primary:red;--x:1}", ".dark { --background: #123; }", "html:root{--ring:blue}", "@layer base{:root{--card:#000}}", "@media print{:root{--primary:#000}}", "@theme inline{--color-primary:var(--brand)}"];
  const outcome = (css: string) => {
    try {
      const r = apply(css);
      expect(skeleton(r.text)).toEqual(skeleton(css)); // 6a: outside the owned area nothing changed
      expect(apply(r.text).changed).toBe(false);
      return "ok";
    } catch (e) {
      if (!(e instanceof ApplyError)) throw e; // anything but a clean refusal is a bug
      return "refused";
    }
  };
  test(`${corpus.length} real files x injected blocks x truncations`, () => {
    expect(corpus.length).toBeGreaterThanOrEqual(13);
    const seen = new Set<string>();
    for (const [name, css] of corpus) {
      seen.add(outcome(css));
      for (let i = 0; i < 12; i++) {
        const pos = css.indexOf("\n", rnd(Math.max(1, css.length))) + 1 || css.length;
        seen.add(outcome(css.slice(0, pos) + BLOCKS[rnd(BLOCKS.length)] + "\n" + css.slice(pos)));
      }
      for (let i = 0; i < 6; i++) { const cut = css.slice(0, rnd(css.length + 1)); seen.add(outcome(cut)); }
      void name;
    }
    expect(seen.has("ok")).toBe(true);
    expect(seen.has("refused")).toBe(true); // truncated files (open braces) must be refused, not spliced
  });
});
