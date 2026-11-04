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
