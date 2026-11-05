// Vercel output until apps/site exists: dist/r as /r/*.json plus a small index page listing them. Run after the build.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("public", { recursive: true, force: true });
mkdirSync("public");
cpSync("dist/r", "public/r", { recursive: true });
const items = readdirSync("public/r").filter((f) => f.endsWith(".json")).sort();
const li = items.map((f) => `<li><a href="/r/${f}">${f}</a> <code>npx shadcn@latest add https://color.gen-nex.tech/r/${f}</code></li>`).join("\n");
writeFileSync("public/index.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>gennex-color</title><style>body{font:16px/1.5 system-ui;max-width:60rem;margin:2rem auto;padding:0 1rem}code{font-size:.8em;color:#555}li{margin:.3rem 0}</style>
<h1>gennex-color</h1>
<p>Radix-style 12-step OKLCH scales with shadcn/ui semantic tokens. <a href="https://github.com/kachitaro/gennex-color">Source and docs</a>. The theme builder is coming; until then these are the shadcn registry items (colors only):</p>
<ul>
${li}
</ul>
</html>
`);
console.log(`public: ${items.length} items + index.html`);
