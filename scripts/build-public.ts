// Vercel output until apps/site exists: dist/r as /r/*.json plus a visual index page (each card is painted with its own theme
// variables, light and dark side by side). Static, no network, no framework. Run after the build.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("public", { recursive: true, force: true });
mkdirSync("public");
cpSync("dist/r", "public/r", { recursive: true });
const files = readdirSync("public/r").filter((f) => f.endsWith(".json")).sort();
type Vars = Record<string, string>;
const items = files.map((f) => {
  const j = JSON.parse(readFileSync(`public/r/${f}`, "utf8")) as { name: string; title: string; cssVars: { light: Vars; dark: Vars } };
  return { file: f, name: j.name, title: j.title, light: j.cssVars.light, dark: j.cssVars.dark };
});
const style = (v: Vars) => Object.entries(v).map(([k, x]) => `--${k}:${x}`).join(";");
const mock = (v: Vars, label: string) => `<div class="mock" style="${style(v)}" aria-label="${label}">
<div class="card"><b>${label}</b><span class="mut">Muted text</span>
<div class="row"><i class="btn p">Primary</i><i class="btn s">Secondary</i><i class="btn d">Delete</i></div>
<div class="chips">${["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].map((c) => `<u style="background:var(--${c})"></u>`).join("")}</div></div></div>`;
const cards = items.map((it) => `<article data-kind="${it.name.includes("devglow") ? "devglow" : "core"}">
<h2>${it.title}</h2>
<div class="pair">${mock(it.light, "Light")}${mock(it.dark, "Dark")}</div>
<div class="cmd"><code>npx shadcn@latest add https://color.gen-nex.tech/r/${it.file}</code><button type="button" aria-label="Copy command for ${it.title}">Copy</button></div>
<a href="/r/${it.file}">${it.file}</a></article>`).join("\n");

writeFileSync("public/index.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>gennex-color: shadcn/ui themes</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#171717;--mut:#6b6b6b;--bd:#e5e5e5}
@media(prefers-color-scheme:dark){:root{--bg:#0d0d0d;--fg:#f2f2f2;--mut:#9a9a9a;--bd:#2a2a2a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:72rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
h1{font-size:2rem;margin:0 0 .5rem}p.lead{color:var(--mut);max-width:44rem;margin:0 0 1.5rem}
nav{display:flex;gap:.5rem;margin-bottom:1.5rem}nav button{font:inherit;padding:.35rem .9rem;border:1px solid var(--bd);border-radius:999px;background:none;color:var(--fg);cursor:pointer}
nav button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(21rem,1fr));gap:1.25rem}
article{border:1px solid var(--bd);border-radius:1rem;padding:1rem}article[hidden]{display:none}
h2{font-size:1rem;margin:0 0 .75rem;text-transform:capitalize}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.mock{background:var(--background);border-radius:.75rem;padding:.6rem;border:1px solid var(--border)}
.card{background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:.6rem;padding:.6rem;display:grid;gap:.4rem;font-size:.8rem}
.mut{color:var(--muted-foreground)}.row{display:flex;gap:.3rem;flex-wrap:wrap}
.btn{font-style:normal;padding:.15rem .5rem;border-radius:.4rem;font-size:.72rem}
.p{background:var(--primary);color:var(--primary-foreground)}.s{background:var(--secondary);color:var(--secondary-foreground)}.d{background:var(--destructive);color:var(--destructive-foreground,#fff)}
.chips{display:flex;gap:.25rem}.chips u{flex:1;height:.5rem;border-radius:.25rem}
.cmd{display:flex;gap:.4rem;margin:.75rem 0 .35rem;align-items:center}
code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem;background:var(--bd);padding:.35rem .5rem;border-radius:.4rem}
.cmd button{font:inherit;font-size:.75rem;padding:.3rem .6rem;border:1px solid var(--bd);border-radius:.4rem;background:none;color:var(--fg);cursor:pointer}
article>a{font-size:.75rem;color:var(--mut)}footer{margin-top:2.5rem;color:var(--mut);font-size:.85rem}a{color:inherit}
</style>
<main>
<h1>gennex-color</h1>
<p class="lead">Radix-style 12-step OKLCH scales with shadcn/ui semantic tokens. Pick a theme, copy the command, run it in a shadcn project. Colors only: radius and fonts stay yours. A full theme builder is coming; <a href="https://github.com/kachitaro/gennex-color">source and docs</a>.</p>
<nav aria-label="Filter"><button type="button" aria-pressed="true" data-f="all">All ${items.length}</button><button type="button" aria-pressed="false" data-f="core">Core hues</button><button type="button" aria-pressed="false" data-f="devglow">Devglow</button></nav>
<div class="grid">
${cards}
</div>
<footer>For an existing project with several <code style="display:inline;padding:.1rem .3rem">:root</code> rules, prefer <code style="display:inline;padding:.1rem .3rem">npx gennex-color@next apply --preset &lt;name&gt;</code>: it edits your CSS in place and warns when something can override the theme.</footer>
</main>
<script>
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.setAttribute("aria-pressed",x===b));
document.querySelectorAll("article").forEach(a=>a.hidden=b.dataset.f!=="all"&&a.dataset.kind!==b.dataset.f)});
document.querySelectorAll(".cmd button").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.previousElementSibling.textContent);b.textContent="Copied";setTimeout(()=>b.textContent="Copy",1200)}catch{b.textContent="Select it"}});
</script>
</html>
`);
console.log(`public: ${items.length} items + index.html`);
