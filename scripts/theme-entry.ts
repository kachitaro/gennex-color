// Browser entry for the preview: exposes the library as window.gennex (classic script, works from file://).
import * as g from "../src/index";
(globalThis as unknown as { gennex: typeof g }).gennex = g;
