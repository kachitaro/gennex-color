// Slider cost in headless Chrome, with and without 4x CPU throttling (Chrome DevTools Protocol, no extra dependency).
// Needs a built example: bun run smoke:example. Run: bun scripts/perf-example.ts
import { spawn } from "node:child_process";

const dist = "examples/vite-app/dist", port = 4321, dbg = 9333;
const server = Bun.serve({ port, fetch(r) { const p = new URL(r.url).pathname; return new Response(Bun.file(dist + (p === "/" ? "/index.html" : p))); } });
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${dbg}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let target = "";
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = ((await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json()) as any[]).find((t) => t.type === "page")?.webSocketDebuggerUrl ?? ""; } catch {} }
if (!target) throw new Error("could not reach Chrome");
const ws = new WebSocket(target);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>();
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); pending.get(d.id)?.(d); };
const send = (method: string, params: object = {}) => new Promise<any>((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

const BENCH = `(async () => {
  const f = window.__gennexUpdate, sync = [], frames = [], parts = [];  let last = performance.now();
  for (let i = 0; i < 3; i++) f(i * 7); // warm-up
  for (let h = 0; h <= 360; h += 3) {
    sync.push(f(h)); parts.push({ ...window.__gennexParts });
    await new Promise((r) => requestAnimationFrame((t) => { frames.push(t - last); last = t; r(); }));
  }
  return { sync, frames, parts };
})()`;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
const out: string[] = [];
for (const rate of [1, 4]) {
  await send("Emulation.setCPUThrottlingRate", { rate });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/?hue=255` });
  await sleep(2500);
  const r = await send("Runtime.evaluate", { expression: BENCH, awaitPromise: true, returnByValue: true });
  const { sync, frames, parts } = r.result.result.value as { sync: number[]; frames: number[]; parts: Record<"build" | "apply" | "recalc", number>[] };
  const f = (n: number) => n.toFixed(1);
  out.push(`CPU ${rate}x: update (buildTheme + apply + style recalc) median ${f(pct(sync, 0.5))} ms, p95 ${f(pct(sync, 0.95))} ms, max ${f(Math.max(...sync))} ms over ${sync.length} hues; frame interval median ${f(pct(frames, 0.5))} ms, p95 ${f(pct(frames, 0.95))} ms\n        median parts: buildTheme ${f(pct(parts.map((p) => p.build), 0.5))} ms, applyThemeToRoot ${f(pct(parts.map((p) => p.apply), 0.5))} ms, style recalc ${f(pct(parts.map((p) => p.recalc), 0.5))} ms`);
}
console.log(out.join("\n"));
ws.close(); chrome.kill(); server.stop(true);
