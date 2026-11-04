// End-to-end smoke: pack the real package tarball, install it into examples/vite-app the way a user would (dependencies
// come transitively, nothing else is added), build that Vite + Tailwind v4 + shadcn app, and check the built CSS carries
// our theme. Run: bun run smoke:example
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const run = (cmd: string[], cwd = ".") => {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout.toString();
};

const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
run(["bun", "run", "build"]);
rmSync(".pack", { recursive: true, force: true });
mkdirSync(".pack");
run(["bun", "pm", "pack", "--destination", ".pack"]);

const ex = "examples/vite-app";
const pkg = JSON.parse(readFileSync(`${ex}/package.json`, "utf8"));
pkg.dependencies["gennex-color"] = `file:../../.pack/gennex-color-${version}.tgz`;
writeFileSync(`${ex}/package.json`, JSON.stringify(pkg, null, 2) + "\n");
rmSync(`${ex}/bun.lock`, { force: true });
rmSync(`${ex}/node_modules/gennex-color`, { recursive: true, force: true });
run(["bun", "install"], ex);
if (!readdirSync(`${ex}/node_modules`).includes("culori")) throw new Error("culori was not installed as a dependency of the tarball");
run(["bun", "run", "build"], ex);

const dir = `${ex}/dist/assets`;
const css = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.endsWith(".css"))!}`, "utf8");
// Lightning CSS rewrites oklch(0.99 ..) as oklch(99% ..) and drops leading zeros, so compare numerically.
const parse = (v: string) => { const [l, c, h] = v.trim().split(/\s+/); return [l.endsWith("%") ? parseFloat(l) / 100 : parseFloat(l), parseFloat(c), parseFloat(h)]; };
const builtVars = new Map<string, number[][]>();
for (const m of css.matchAll(/--([\w-]+):oklch\(([^)]*)\)/g)) builtVars.set(m[1], [...(builtVars.get(m[1]) ?? []), parse(m[2])]);
const source = readFileSync("dist/css/blue.css", "utf8");
const root = source.slice(source.indexOf(":root {"), source.indexOf(".dark {"));
const dark = source.slice(source.indexOf(".dark {"), source.indexOf("@theme inline"));
const decls = (b: string) => [...b.matchAll(/^\s+--([\w-]+): oklch\(([^)]*)\);$/gm)].map((m) => [m[1], parse(m[2])] as const);
const miss = [...decls(root), ...decls(dark)].filter(([k, want]) => !(builtVars.get(k) ?? []).some((got) => got.every((x, i) => Math.abs(x - want[i]) < 1e-3)));
if (miss.length) throw new Error(`theme variables missing from built CSS: ${miss.slice(0, 5).map((m) => m[0]).join(", ")} (+${miss.length})`);
for (const cls of [".bg-primary", ".text-primary-foreground", ".bg-card", ".border-input", ".text-muted-foreground", ".text-destructive", ".text-primary", ".bg-secondary", ".bg-destructive\\/10", ".aria-invalid\\:border-destructive"]) {
  if (!css.includes(cls)) throw new Error(`utility ${cls} not generated`);
}
if ((builtVars.get("primary") ?? []).some((v) => Math.abs(v[0] - 0.205) < 1e-3 && v[1] === 0)) throw new Error("shadcn default theme leaked into the build");
const js = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.endsWith(".js"))!}`, "utf8");
if (!js.includes("data-gennex-theme-style")) throw new Error("applyThemeToRoot is not in the built app");
console.log(`example build ok: ${decls(root).length + decls(dark).length} theme variables present, utilities generated`);
