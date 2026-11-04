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
