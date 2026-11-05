// Clean-install smoke: an empty temp directory, ONLY the packed tarball installed (dependencies come transitively), then
// import the public API and run it under Node and Bun. Run: bun run smoke:clean
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const run = (cmd: string[], cwd: string) => {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} (in ${cwd}) failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout.toString().trim();
};
const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
run(["bun", "run", "build"], ".");
rmSync(".pack", { recursive: true, force: true });
mkdirSync(".pack");
run(["bun", "pm", "pack", "--destination", ".pack"], ".");
const tgz = resolve(`.pack/gennex-color-${version}.tgz`);

const CHECK = `
import { applyThemeToRoot, buildTheme, generateScale, toCss, nameOfHue } from "gennex-color";
const s = generateScale({ hue: 255, mode: "light" });
const t = buildTheme({ hue: 40, neutral: "warm" });
if (s.hex.length !== 12 || Object.keys(t.light).length !== Object.keys(t.dark).length || !toCss(t).includes(":root {")) throw new Error("bad output");
if (nameOfHue(40).name !== "coral") throw new Error("nameOfHue");
let msg = ""; try { applyThemeToRoot(t); } catch (e) { msg = String(e.message); }
if (!/DOM/.test(msg)) throw new Error("applyThemeToRoot should refuse to run without a DOM, got: " + msg);
console.log("ok", s.hex[8], t.light.primary, typeof applyThemeToRoot);
`;
const results: string[] = [];
for (const installer of ["npm", "bun"] as const) {
  const dir = mkdtempSync(join(tmpdir(), `gennex-clean-${installer}-`));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "clean", private: true, type: "module" }));
    writeFileSync(join(dir, "check.mjs"), CHECK);
    run(installer === "npm" ? ["npm", "install", tgz, "--no-audit", "--no-fund", "--loglevel=error"] : ["bun", "add", tgz], dir);
    const installed = readdirSync(join(dir, "node_modules")).filter((n) => !n.startsWith(".")).sort();
    if (installed.join() !== "culori,gennex-color,nanoid,picocolors,postcss,source-map-js") throw new Error(`${installer}: expected exactly culori + gennex-color, got ${installed.join()}`);
    for (const rt of ["node", "bun"]) results.push(`${installer}-install/${rt}: ${run([rt, "check.mjs"], dir)}`);
    // the CLI from the installed package: apply to a real shadcn init file, then --check must pass
    const css = join(dir, "src/index.css");
    mkdirSync(join(dir, "src"));
    cpSync("test/fixtures/css/shadcn-init-default.css", css);
    writeFileSync(join(dir, "components.json"), JSON.stringify({ tailwind: { config: "", css: "src/index.css" } }));
    const bin = join(dir, "node_modules/.bin/gennex-color");
    for (const rt of ["node", "bun"]) {
      cpSync("test/fixtures/css/shadcn-init-default.css", css);
      run([rt, bin, "apply", "--hue", "40", "--neutral", "warm"], dir);
      run([rt, bin, "apply", "--hue", "40", "--neutral", "warm", "--check"], dir);
      results.push(`${installer}-install/cli via ${rt}: ${run([rt, bin, "info"], dir).split("\n")[0]}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log(results.join("\n"));
