// §6D integration job (needs network): real `shadcn init` -> gennex-color apply -> --check -> real build; `shadcn add` after apply keeps our
// colors; `shadcn apply <preset>` overwrites them and --check must then exit 1. Pinned shadcn; set SHADCN=latest to watch for format changes.
// Run: bun run integration:shadcn   (build first: bun run build)
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SHADCN = `shadcn@${process.env.SHADCN ?? "4.23.0"}`;
const BIN = resolve("dist/bin.mjs");
const sh = (cmd: string[], cwd: string, okCodes = [0]) => {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, CI: "1" } });
  if (!okCodes.includes(r.exitCode)) throw new Error(`${cmd.join(" ")} -> ${r.exitCode}\n${r.stdout}\n${r.stderr}`);
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
};
const ours = (cwd: string, ...a: string[]) => sh(["node", BIN, ...a], cwd, [0, 1, 2, 3]);
const must = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };
const FLAGS = ["--hue", "40", "--neutral", "warm"];
const results: string[] = [];

for (const preset of ["nova", "lyra"]) {
  const root = mkdtempSync(join(tmpdir(), `gx-int-${preset}-`));
  try {
    for (let i = 1; ; i++) { // shadcn fetches ui.shadcn.com; one transient timeout must not fail the job
      try { sh(["bunx", SHADCN, "init", "-t", "vite", "-b", "radix", "-p", preset, "-n", "app", "-y", "--no-monorepo"], root); break; } catch (e) { if (i === 3) throw e; rmSync(join(root, "app"), { recursive: true, force: true }); }
    }
    const app = join(root, "app"), css = join(app, "src/index.css");
    const before = readFileSync(css, "utf8");
    must(ours(app, "apply", ...FLAGS, "--check").code === 1, `${preset}: --check should fail before apply`);
    const a = ours(app, "apply", ...FLAGS);
    must(a.code === 0, `${preset}: apply failed\n${a.out}`);
    must(ours(app, "apply", ...FLAGS, "--check").code === 0, `${preset}: --check should pass after apply`);
    const after = readFileSync(css, "utf8");
    for (const keep of before.split("\n").filter((l) => /--radius|--font|@import|@layer base/.test(l))) must(after.includes(keep), `${preset}: lost line ${keep}`);

    sh(["bun", "run", "build"], app);
    const dir = join(app, "dist/assets"), built = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith(".css"))!), "utf8");
    must(built.includes("--radius") && /--primary-text:oklch/.test(built), `${preset}: built CSS lacks radius or our tokens`);

    sh(["bunx", SHADCN, "add", "card", "-y"], app);
    must(ours(app, "apply", ...FLAGS, "--check").code === 0, `${preset}: shadcn add card disturbed our colors`);

    sh(["bunx", SHADCN, "apply", preset, "--only", "theme", "-y"], app);
    const c = ours(app, "apply", ...FLAGS, "--check");
    must(c.code === 1, `${preset}: after \`shadcn apply ${preset}\` --check should exit 1, got ${c.code}\n${c.out}`);
    results.push(`${preset}: init -> apply -> check 0 -> build ok -> add card keeps colors -> shadcn apply overrides, --check exit 1 (${c.out.match(/W\d/g)?.join(",") ?? "file differs"})`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
