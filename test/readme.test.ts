import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TOKEN_NAMES } from "../src/theme";

const readme = readFileSync("README.md", "utf8");

test("README token table lists exactly the tokens buildTheme emits", () => {
  const section = readme.slice(readme.indexOf("## Tokens"));
  const listed = [...section.matchAll(/^\| `([\w-]+)` \|/gm)].map((m) => m[1]);
  expect(listed.sort()).toEqual([...TOKEN_NAMES].sort());
});

test("README states the package version", () => {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  expect(readme).toContain(`gennex-color@${version}`);
});

test("license: package.json, LICENSE and README agree on MIT", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.license).toBe("MIT");
  expect(pkg.files).toContain("LICENSE");
  expect(readFileSync("LICENSE", "utf8")).toMatch(/^MIT License\n\nCopyright \(c\) 2026 \S+/);
  expect(readme).toMatch(/## License\n\nMIT/);
  expect(readme).not.toContain("No license has been chosen");
});

test("README states the three measured `shadcn add` limits and the misleading gh/GH_TOKEN error", () => {
  const section = readme.slice(readme.indexOf("**Prefer `gennex-color apply`"), readme.indexOf("## Change the theme at runtime"));
  expect(section).toMatch(/several `:root` rules[^.]*only the first/);
  expect(section).toMatch(/`:root` inside `@layer base`[^.]*appended/);
  expect(section).toMatch(/`@custom-variant dark`[^.]*`@theme inline`[^.]*LF and CRLF/);
  expect(section).toMatch(/`GH_TOKEN`[\s\S]*misleading/);
});

test("README lists every warning code the editor can emit and every exit code", () => {
  for (const c of ["W1", "W2", "W3", "W4", "W5"]) expect(readme).toContain(`| \`${c}\` |`);
  expect(readme).toMatch(/Exit codes: `0`[\s\S]*`1`[\s\S]*`2`[\s\S]*`3`/);
});
