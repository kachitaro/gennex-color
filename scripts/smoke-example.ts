// End-to-end smoke: pack the real package tarball, install it into examples/vite-app, build that Vite + Tailwind v4 +
// shadcn app, and check the built CSS carries our theme. Run: bun run smoke:example
import { readdirSync, readFileSync, mkdirSync, rmSync } from "node:fs";

const run = (cmd: string[], cwd = ".") => {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout.toString();
};

run(["bun", "run", "build"]);
rmSync(".pack", { recursive: true, force: true });
mkdirSync(".pack");
run(["bun", "pm", "pack", "--destination", ".pack"]);
const mod = "examples/vite-app/node_modules/gennex-color";
rmSync(mod, { recursive: true, force: true });
mkdirSync(mod, { recursive: true });
run(["tar", "-xzf", ".pack/gennex-color-0.0.0.tgz", "-C", mod, "--strip-components=1"]);
run(["bun", "run", "build"], "examples/vite-app");

const dir = "examples/vite-app/dist/assets";
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
for (const cls of [".bg-primary", ".text-primary-foreground", ".bg-card", ".border-input", ".text-muted-foreground", ".bg-destructive"]) {
  if (!css.includes(cls)) throw new Error(`utility ${cls} not generated`);
}
if ((builtVars.get("primary") ?? []).some((v) => Math.abs(v[0] - 0.205) < 1e-3 && v[1] === 0)) throw new Error("shadcn default theme leaked into the build");
console.log(`example build ok: ${decls(root).length + decls(dark).length} theme variables present, utilities generated`);
