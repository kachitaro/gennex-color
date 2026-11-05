// Writes dist/registry.json and dist/r/theme-<preset>.json (shadcn registry items, colors only). Run after tsdown.
import { mkdir } from "node:fs/promises";
import { buildRegistry } from "../src/registry";

const { items, registry } = buildRegistry();
await mkdir("dist/r", { recursive: true });
for (const i of items) await Bun.write(`dist/r/${i.name}.json`, JSON.stringify(i, null, 2) + "\n");
await Bun.write("dist/registry.json", JSON.stringify(registry, null, 2) + "\n");
console.log(`wrote ${items.length} registry items to dist/r and dist/registry.json`);
