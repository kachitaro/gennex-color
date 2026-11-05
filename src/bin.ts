#!/usr/bin/env node
import { main } from "./cli";

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (s) => void process.stdout.write(s),
  err: (s) => void process.stderr.write(s),
});
