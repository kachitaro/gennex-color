import { describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli";
import { encodeConfig, normalizeConfig } from "../src/code";
import { buildTheme } from "../src/theme";
import { toRegistryItem } from "../src/registry";
import { configToThemeOptions } from "../src/code";

const fx = (n: string) => join(import.meta.dir, "fixtures/css", n);
function project(css: string, opts: { cssPath?: string; components?: object | null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gx-cli-"));
  const cssPath = opts.cssPath ?? "src/index.css";
  mkdirSync(join(dir, cssPath, ".."), { recursive: true });
  writeFileSync(join(dir, cssPath), css);
  if (opts.components !== null) writeFileSync(join(dir, "components.json"), JSON.stringify(opts.components ?? { tailwind: { config: "", css: cssPath, baseColor: "neutral", cssVariables: true } }));
  return dir;
}
async function run(args: string[], cwd: string) {
  let out = "", err = "";
  const code = await main(args, { cwd, out: (s) => (out += s), err: (s) => (err += s) });
  return { code, out, err };
}
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const INIT = readFileSync(fx("shadcn-init-default.css"), "utf8");
const CODE = encodeConfig(normalizeConfig({ hue: 40, neutral: "warm" }));

describe("apply", () => {
  test("writes the theme, prints a summary with the code, exit 0; the file gets the marker", async () => {
    const d = project(INIT);
    const r = await run(["apply", "--hue", "40", "--neutral", "warm"], d);
    expect(r.code).toBe(0);
    expect(r.out).toContain(CODE);
    expect(r.out).toMatch(/src\/index\.css/);
    const css = readFileSync(join(d, "src/index.css"), "utf8");
    expect(css).toMatch(new RegExp(`/\\* gennex-color \\d+\\.\\d+\\.\\d+ · ${CODE} \\*/`));
    expect(css).toContain("--primary-text:");
  });
  test("a code (positional or --code) gives the same file as the flags", async () => {
    const a = project(INIT), b = project(INIT), c = project(INIT);
    await run(["apply", "--hue", "40", "--neutral", "warm"], a);
    await run(["apply", CODE], b);
    await run(["apply", "--code", CODE], c);
    expect(readFileSync(join(a, "src/index.css"), "utf8")).toBe(readFileSync(join(b, "src/index.css"), "utf8"));
    expect(readFileSync(join(a, "src/index.css"), "utf8")).toBe(readFileSync(join(c, "src/index.css"), "utf8"));
  });
  test("--dry-run: file bytes and mtime untouched, a diff is printed, exit 0", async () => {
    const d = project(INIT), p = join(d, "src/index.css");
    utimesSync(p, 1_000_000, 1_000_000);
    const h = sha(p), m = statSync(p).mtimeMs;
    const r = await run(["apply", CODE, "--dry-run"], d);
    expect(r.code).toBe(0);
    expect(sha(p)).toBe(h);
    expect(statSync(p).mtimeMs).toBe(m);
    expect(r.out).toMatch(/^--- src\/index\.css$/m);
    expect(r.out).toMatch(/^\+ +--primary-text: oklch\(/m);
    expect(r.out).not.toMatch(/^\+.*--font-sans/m);
  });
  test("--print writes the resulting CSS to stdout and not to the file", async () => {
    const d = project(INIT), p = join(d, "src/index.css"), h = sha(p);
    const r = await run(["apply", CODE, "--print"], d);
    expect(r.out).toContain("--primary-text:");
    expect(r.out).toContain("@layer base");
    expect(sha(p)).toBe(h);
  });
  test("--check: 1 while the file differs, 0 once applied, 1 again when something can override our color", async () => {
    const d = project(INIT);
    expect((await run(["apply", CODE, "--check"], d)).code).toBe(1);
    expect((await run(["apply", CODE], d)).code).toBe(0);
    expect((await run(["apply", CODE, "--check"], d)).code).toBe(0);
    writeFileSync(join(d, "src/index.css"), readFileSync(join(d, "src/index.css"), "utf8") + "\nbody { --primary: red; }\n");
    const r = await run(["apply", CODE, "--check"], d);
    expect(r.code).toBe(1);
    expect(r.out + r.err).toMatch(/W2/);
  });
  test("nothing to change: says so and does not touch the file (mtime)", async () => {
    const d = project(INIT), p = join(d, "src/index.css");
    await run(["apply", CODE], d);
    utimesSync(p, 1_000_000, 1_000_000);
    const r = await run(["apply", CODE], d);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/up to date|no changes/i);
    expect(statSync(p).mtimeMs).toBe(1_000_000_000);
  });
  test("warnings are printed with code, line and selector, even when applying", async () => {
    const d = project('@import "tailwindcss";\n:root { --primary: #000; }\nhtml:root { --primary: red; }\n');
    const r = await run(["apply", CODE], d);
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/W1.*line 3.*html:root.*--primary/s);
  });
  test("--json: stable machine-readable report", async () => {
    const d = project('@import "tailwindcss";\n:root { --primary: #000; }\nbody { --primary: red; }\n');
    const r = await run(["apply", CODE, "--json", "--dry-run"], d);
    const j = JSON.parse(r.out);
    expect(Object.keys(j).sort()).toEqual(["changed", "code", "exit", "file", "findings", "stats"]);
    expect(j.code).toBe(CODE);
    expect(j.findings[0]).toMatchObject({ code: "W2", token: "primary", line: 3 });
  });
  test("--no-marker and --tokens shadcn", async () => {
    const d = project(INIT);
    await run(["apply", CODE, "--no-marker", "--tokens", "shadcn"], d);
    const css = readFileSync(join(d, "src/index.css"), "utf8");
    expect(css).not.toContain("gennex-color");
    expect(css).not.toContain("--primary-text");
  });
  test("--force: our prebuilt import is refused (exit 3) without it", async () => {
    const d = project('@import "tailwindcss";\n@import "gennex-color/css/blue.css";\n');
    expect((await run(["apply", CODE], d)).code).toBe(3);
    expect((await run(["apply", CODE, "--force"], d)).code).toBe(0);
  });
});

describe("finding the file", () => {
  test("components.json, --css, --cwd, Next layout", async () => {
    const d = project(INIT, { cssPath: "app/globals.css" });
    expect((await run(["apply", CODE], d)).code).toBe(0);
    expect(readFileSync(join(d, "app/globals.css"), "utf8")).toContain("--primary-text");
    const e = project(INIT, { components: null });
    expect((await run(["apply", CODE], e)).code).toBe(2);
    expect((await run(["apply", CODE, "--css", "src/index.css"], e)).code).toBe(0);
    const outer = mkdtempSync(join(tmpdir(), "gx-mono-"));
    cpSync(project(INIT), join(outer, "packages/ui"), { recursive: true });
    expect((await run(["apply", CODE, "--cwd", "packages/ui"], outer)).code).toBe(0);
    expect((await run(["apply", CODE], outer)).code).toBe(2); // no components.json at the root: never guess upward or downward
  });
  test("exit 2: missing css file, symlink leaving the project, binary, non-UTF-8, too big", async () => {
    const d = project(INIT);
    expect((await run(["apply", CODE, "--css", "nope.css"], d)).code).toBe(2);
    const outside = mkdtempSync(join(tmpdir(), "gx-out-"));
    writeFileSync(join(outside, "x.css"), INIT);
    symlinkSync(join(outside, "x.css"), join(d, "src/link.css"));
    const r = await run(["apply", CODE, "--css", "src/link.css"], d);
    expect(r.code).toBe(2);
    expect(readFileSync(join(outside, "x.css"), "utf8")).toBe(INIT);
    for (const bad of [Buffer.from([0x3a, 0x72, 0, 1, 2]), Buffer.from([0xff, 0xfe, 0x3a, 0x00]), Buffer.alloc(2_100_000, 97)]) {
      writeFileSync(join(d, "src/bad.css"), bad);
      const h = sha(join(d, "src/bad.css"));
      expect((await run(["apply", CODE, "--css", "src/bad.css"], d)).code).toBe(2);
      expect(sha(join(d, "src/bad.css"))).toBe(h);
    }
  });
  test("read-only file: exit 2, nothing written (even though rename could replace it)", async () => {
    const d = project(INIT), p = join(d, "src/index.css");
    chmodSync(p, 0o444);
    const h = sha(p);
    expect((await run(["apply", CODE], d)).code).toBe(2);
    expect(sha(p)).toBe(h);
  });
  test("exit 3: Tailwind v3 project (tailwind.config set) and v3 css", async () => {
    const v3 = project(INIT, { components: { tailwind: { config: "tailwind.config.js", css: "src/index.css" } } });
    expect((await run(["apply", CODE], v3)).code).toBe(3);
    const v3css = project("@tailwind base;\n:root{--background:0 0% 100%}\n");
    expect((await run(["apply", CODE], v3css)).code).toBe(3);
  });
});

describe("never damages the file", () => {
  test("unbalanced CSS: exit 2, bytes and mtime unchanged, no temp files left", async () => {
    const d = project(":root{--background:#fff");
    const p = join(d, "src/index.css"), h = sha(p), before = readdirSync(join(d, "src")).join();
    const r = await run(["apply", CODE], d);
    expect(r.code).toBe(2);
    expect(sha(p)).toBe(h);
    expect(readdirSync(join(d, "src")).join()).toBe(before);
  });
  test("atomic write: no leftovers, permissions and line endings kept", async () => {
    const d = project(readFileSync(fx("case-C-crlf-bom.css"), "utf8")), p = join(d, "src/index.css");
    chmodSync(p, 0o640);
    const before = readdirSync(join(d, "src"));
    expect((await run(["apply", CODE], d)).code).toBe(0);
    expect(readdirSync(join(d, "src"))).toEqual(before);
    expect(statSync(p).mode & 0o777).toBe(0o640);
    const css = readFileSync(p);
    expect(css.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(css.toString().match(/(?<!\r)\n/g) ?? []).toEqual([]);
  });
  test("no network: the CLI never imports a networking module or calls fetch", () => {
    for (const f of ["cli.ts", "css-apply.ts", "cli-config.ts", "diff.ts", "bin.ts"]) {
      const p = join(import.meta.dir, "../src", f);
      if (!existsSync(p)) continue;
      const s = readFileSync(p, "utf8");
      expect([f, /node:(http|https|net|dns|tls|http2)|\bfetch\(|XMLHttpRequest|child_process/.test(s)]).toEqual([f, false]);
    }
  });
});

describe("other commands", () => {
  test("encode prints the code of the flags; decode prints the config; info reads the marker", async () => {
    const d = project(INIT);
    expect((await run(["encode", "--hue", "40", "--neutral", "warm"], d)).out.trim()).toBe(CODE);
    const dec = JSON.parse((await run(["decode", CODE, "--json"], d)).out);
    expect(dec.config.hue).toBe(40);
    expect(dec.epoch).toBe(1);
    await run(["apply", CODE], d);
    expect((await run(["info"], d)).out).toContain(CODE);
    expect((await run(["decode", CODE.slice(0, -1) + "0"], d)).code).toBe(2);
  });
  test("registry-item <code> prints exactly the item of that code (and works without a project)", async () => {
    const d = mkdtempSync(join(tmpdir(), "gx-empty-"));
    const r = await run(["registry-item", CODE, "--name", "theme-mine"], d);
    expect(r.code).toBe(0);
    const config = normalizeConfig({ hue: 40, neutral: "warm" });
    const want = toRegistryItem(buildTheme(configToThemeOptions(config)), { name: "theme-mine", title: CODE, description: `gennex-color ${CODE}`, config });
    expect(JSON.parse(r.out)).toEqual(want);
  });
  test("usage errors exit 2 with a message; --help exits 0", async () => {
    const d = mkdtempSync(join(tmpdir(), "gx-u-"));
    expect((await run([], d)).code).toBe(2);
    expect((await run(["bogus"], d)).code).toBe(2);
    expect((await run(["apply", "--wat"], d)).code).toBe(2);
    expect((await run(["apply"], d)).code).toBe(2);
    const h = await run(["--help"], d);
    expect(h.code).toBe(0);
    expect(h.out).toMatch(/apply[\s\S]*registry-item/);
  });
});
