import { accessSync, chmodSync, constants, existsSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../package.json";
import { ConfigError, resolveConfig, type ConfigFlags } from "./cli-config";
import { CodeError, configToThemeOptions, decodeCode } from "./code";
import { ApplyError, applyTheme, readMarker, type Finding } from "./css-apply";
import { unifiedDiff } from "./diff";
import { toRegistryItem } from "./registry";
import { buildTheme } from "./theme";

export interface CliIo { cwd: string; out: (s: string) => void; err: (s: string) => void }

const HELP = `gennex-color ${pkg.version}: apply a gennex-color theme to a shadcn/ui project

Usage
  gennex-color apply [<code>] [options]     edit the project's CSS (only the color variables)
  gennex-color encode <config options>      print the share code of a configuration
  gennex-color decode <code> [--json]       print the configuration of a share code
  gennex-color info [--cwd dir]             show the code/version last applied to the project
  gennex-color registry-item <code> [--name n]   print a shadcn registry:theme item (for \`shadcn add ./item.json\`)

Configuration (or a code, positional or --code)
  --hue <0-360>  --kappa <0.35-0.85>  --neutral neutral|cool|warm|auto|<hue>:<chroma>[:<chromaDark>]
  --page 1|2  --primary accessible|vivid  --status destructive=25,warning=70
  --preset <core hue name>  --devglow <palette> [--dark-chroma-cap 0.06]   (other options override them)

apply options
  --cwd <dir>        project directory (default: current)
  --css <path>       the CSS file (default: tailwind.css of components.json)
  --dry-run          show the diff, write nothing
  --check            exit 1 if the file would change or a color can lose (for CI)
  --print            print the resulting CSS, write nothing
  --tokens all|shadcn  all 52 tokens (default) or only the 31 shadcn names
  --force            overwrite conflicting --color-* mappings; allow the prebuilt import
  --no-marker        do not add/refresh the "gennex-color <version> · <code>" comment
  --json             machine-readable report

Exit codes: 0 done / nothing to do, 1 --check found a difference, 2 error (nothing written), 3 project not supported (Tailwind v3, ...)
`;

const options = {
  code: { type: "string" }, hue: { type: "string" }, kappa: { type: "string" }, neutral: { type: "string" }, page: { type: "string" },
  primary: { type: "string" }, status: { type: "string" }, preset: { type: "string" }, devglow: { type: "string" }, "dark-chroma-cap": { type: "string" },
  cwd: { type: "string" }, css: { type: "string" }, name: { type: "string" }, tokens: { type: "string" },
  "dry-run": { type: "boolean" }, check: { type: "boolean" }, print: { type: "boolean" }, force: { type: "boolean" }, "no-marker": { type: "boolean" },
  json: { type: "boolean" }, yes: { type: "boolean" }, help: { type: "boolean", short: "h" },
} as const;

class CliError extends Error {
  constructor(public exit: 2 | 3, message: string) { super(message); }
}
const MAX_BYTES = 2_000_000;

function locateCss(cwd: string, css: string | undefined) {
  let abs: string;
  if (css) abs = resolve(cwd, css);
  else {
    const cj = join(cwd, "components.json");
    if (!existsSync(cj)) throw new CliError(2, `no components.json in ${cwd}: run this in a shadcn project, or pass --css <file> (--cwd <dir> for another directory)`);
    let json: { tailwind?: { config?: string; css?: string } };
    try { json = JSON.parse(readFileSync(cj, "utf8")); } catch { throw new CliError(2, "components.json is not valid JSON"); }
    if (json.tailwind?.config) throw new CliError(3, `components.json sets tailwind.config ("${json.tailwind.config}"): that is a Tailwind v3 project; only Tailwind v4 is supported`);
    if (!json.tailwind?.css) throw new CliError(2, "components.json has no tailwind.css; pass --css <file>");
    abs = resolve(cwd, json.tailwind.css);
  }
  let real: string, base: string;
  try { real = realpathSync(abs); base = realpathSync(cwd); } catch { throw new CliError(2, `file not found: ${abs}`); }
  if (real !== base && !real.startsWith(base + sep)) throw new CliError(2, `${abs} resolves outside the project (${real}); refusing to touch it`);
  const st = statSync(real);
  if (!st.isFile()) throw new CliError(2, `${abs} is not a file`);
  try { accessSync(real, constants.W_OK); } catch { throw new CliError(2, `${abs} is read-only; refusing (rename would replace it)`); }
  if (st.size > MAX_BYTES) throw new CliError(2, `${abs} is larger than 2 MB; refusing`);
  const buf = readFileSync(real);
  if (buf.includes(0)) throw new CliError(2, `${abs} looks binary (NUL byte); refusing`);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf); } catch { throw new CliError(2, `${abs} is not valid UTF-8; refusing`); }
  return { real, rel: relative(cwd, real).split(sep).join("/"), text, mode: st.mode & 0o777 };
}

/** Write next to the file, then rename: the file is either the old one or the new one, never half written. */
function writeAtomic(path: string, text: string, mode: number) {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  try { writeFileSync(tmp, text, { mode }); chmodSync(tmp, mode); renameSync(tmp, path); } catch (e) {
    try { unlinkSync(tmp); } catch { /* not created */ }
    throw new CliError(2, `could not write ${path}: ${(e as Error).message}`);
  }
}

const fmt = (f: Finding) => `  ${f.code} line ${f.line ?? "?"}${f.selector ? ` \`${f.selector}\`` : ""}: ${f.message}`;

async function apply(values: Record<string, string | boolean | undefined>, positional: string | undefined, io: CliIo): Promise<number> {
  const { config, code, notes } = resolveConfig(values as ConfigFlags, positional);
  for (const n of notes) io.err(`warning: ${n}\n`);
  const cwd = resolve(io.cwd, typeof values.cwd === "string" ? values.cwd : ".");
  const tokens = values.tokens === undefined ? "all" : values.tokens;
  if (tokens !== "all" && tokens !== "shadcn") throw new ConfigError(`--tokens must be all or shadcn (got "${String(values.tokens)}")`);
  const file = locateCss(cwd, typeof values.css === "string" ? values.css : undefined);
  const theme = buildTheme(configToThemeOptions(config));
  const r = applyTheme(file.text, theme, { tokens, force: values.force === true, marker: values["no-marker"] === true ? null : `gennex-color ${pkg.version} · ${code}` });
  const check = values.check === true, dry = values["dry-run"] === true, print = values.print === true;
  const exit = check && (r.changed || r.findings.length > 0) ? 1 : 0;

  if (values.json === true) {
    io.out(JSON.stringify({ file: file.rel, code, changed: r.changed, stats: r.stats, findings: r.findings, exit }, null, 2) + "\n");
  } else if (print) {
    io.out(r.text);
  } else {
    const s = r.stats;
    io.out(`gennex-color ${pkg.version} · ${code}\n${file.rel}: ${r.changed ? `${s.updated} values updated, ${s.inserted} added, ${s.mapped} @theme mappings, ${s.blocks} blocks created` : "already up to date, no changes"}${dry ? " (dry run: nothing written)" : ""}\n`);
    if (dry && r.changed) io.out("\n" + unifiedDiff(file.text, r.text, file.rel));
    if (r.findings.length > 0) io.out(`\nWarnings (${r.findings.length}): these may stop the theme from taking effect\n${r.findings.map(fmt).join("\n")}\n`);
    if (check && exit === 1) io.err(`check failed: ${r.changed ? "the file differs from the theme" : "colors can be overridden"}\n`);
  }
  if (r.changed && !dry && !check && !print) writeAtomic(file.real, r.text, file.mode);
  return exit;
}

export async function main(argv: string[], io: CliIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
    const [cmd, arg] = positionals;
    if (values.help || cmd === "help") { io.out(HELP); return 0; }
    if (!cmd) { io.err(HELP); return 2; }
    switch (cmd) {
      case "apply": return await apply(values, arg, io);
      case "encode": { io.out(resolveConfig(values as ConfigFlags, arg).code + "\n"); return 0; }
      case "decode": {
        if (!arg) throw new ConfigError("decode needs a code");
        const d = decodeCode(arg);
        io.out(values.json ? JSON.stringify(d, null, 2) + "\n" : `${JSON.stringify(d.config)}\nepoch ${d.epoch}\n${d.warnings.map((w) => `warning: ${w}\n`).join("")}`);
        return 0;
      }
      case "info": {
        const file = locateCss(resolve(io.cwd, typeof values.cwd === "string" ? values.cwd : "."), typeof values.css === "string" ? values.css : undefined);
        const m = readMarker(file.text);
        io.out(m ? `${file.rel}: gennex-color ${m.version} · ${m.code}\n${JSON.stringify(decodeCode(m.code).config)}\n` : `${file.rel}: no gennex-color marker found\n`);
        return 0;
      }
      case "registry-item": {
        const { config, code } = resolveConfig(values as ConfigFlags, arg);
        io.out(JSON.stringify(toRegistryItem(buildTheme(configToThemeOptions(config)), { name: typeof values.name === "string" ? values.name : `gennex-${code}`, title: code, description: `gennex-color ${code}`, config }), null, 2) + "\n");
        return 0;
      }
      default: throw new ConfigError(`unknown command "${cmd}" (apply, encode, decode, info, registry-item)`);
    }
  } catch (e) {
    if (e instanceof CliError || e instanceof ApplyError) { io.err(`error: ${e.message}\n`); return e.exit; }
    if (e instanceof ConfigError || e instanceof CodeError) { io.err(`error: ${e.message}\n`); return 2; }
    if (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS")) { io.err(`error: ${e.message}\n\n${HELP}`); return 2; }
    io.err(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
}
