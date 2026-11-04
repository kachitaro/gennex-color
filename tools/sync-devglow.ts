// Copies devglow's palette data at a pinned commit into presets/devglow.snapshot.json (D8). No network at build or test time.
//   bun tools/sync-devglow.ts --ref <commit sha> [--path <local devglow checkout>]
// Prints what changed (neutral hue/chroma, kappa) against the snapshot being replaced. Review, run the tests, then commit.
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { derivePreset } from "../src/devglow";
import { parseLuaPalette, parseTaglines } from "./devglow-parse";

const REPO = "https://github.com/phatnt199/devglow";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ref = arg("ref");
if (!ref) { console.error("usage: bun tools/sync-devglow.ts --ref <sha> [--path <checkout>]"); process.exit(2); }

const git = (cwd: string, ...a: string[]) => {
  const r = Bun.spawnSync(["git", ...a], { cwd, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.toString().trim();
};
let dir = arg("path");
if (!dir) {
  dir = mkdtempSync(join(tmpdir(), "devglow-"));
  git(dir, "init", "-q"); git(dir, "fetch", "-q", "--depth", "1", REPO, ref); git(dir, "checkout", "-q", "FETCH_HEAD");
}
const sha = git(dir, "rev-parse", "HEAD");
if (!sha.startsWith(ref)) throw new Error(`checkout is at ${sha}, not ${ref}`);

const palDir = join(dir, "lua/devglow/palettes");
const taglines = parseTaglines(readFileSync(join(dir, "README.md"), "utf8"));
const palettes: Record<string, { colors: Record<string, string>; tagline: string }> = {};
for (const f of readdirSync(palDir).filter((f) => f.endsWith(".lua")).sort()) {
  const name = f.replace(".lua", "");
  if (!taglines[name]) throw new Error(`no tagline for ${name} in README`);
  palettes[name] = { colors: parseLuaPalette(readFileSync(join(palDir, f), "utf8")), tagline: taglines[name] };
}
const license = readFileSync(join(dir, "LICENSE"), "utf8");
const copyright = license.match(/^Copyright \(c\) .+$/m)?.[0].replace(/^Copyright \(c\) /, "");
if (!copyright || !/MIT License/.test(license)) throw new Error("LICENSE is not the expected MIT text");

const out = "presets/devglow.snapshot.json";
const prev = existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as { palettes: typeof palettes }) : undefined;
writeFileSync(out, JSON.stringify({ source: { repo: REPO, sha, fetchedAt: new Date().toISOString(), license: "MIT", copyright }, palettes }, null, 2) + "\n");
writeFileSync("NOTICE", `gennex-color presets "devglow-*" are derived from the palette data of devglow
${REPO} at commit ${sha}.

${license.trim()}
`);

console.log(`snapshot: ${Object.keys(palettes).length} palettes at ${sha}`);
for (const [n, p] of Object.entries(palettes)) {
  const a = prev?.palettes[n] ? derivePreset(prev.palettes[n].colors) : undefined, b = derivePreset(p.colors);
  if (!a) { console.log(`  ${n}: new`); continue; }
  const dh = Math.abs(((b.neutral.hue - a.neutral.hue + 540) % 360) - 180);
  if (dh > 5 || a.kappa !== b.kappa || a.neutral.chroma !== b.neutral.chroma) console.log(`  ${n}: neutral hue ${a.neutral.hue}->${b.neutral.hue}, chroma ${a.neutral.chroma}->${b.neutral.chroma}, kappa ${a.kappa}->${b.kappa}`);
}
