import { useEffect, useRef, useState } from "react"
import { applyThemeToRoot, buildTheme, nameOfHue } from "gennex-color"

import { Label } from "@/components/ui/label"

const initialHue = () => {
  const h = Number(new URLSearchParams(window.location.search).get("hue"))
  return Number.isFinite(h) && h >= 0 && h <= 360 ? h : 255
}

/**
 * One theme update, timed: build the theme, swap the CSS variables, then force the style recalculation the browser would
 * do anyway (reading a computed style), so the number includes what the page really pays. Layout and paint are not included.
 */
const parts = { build: 0, apply: 0, recalc: 0 }
function update(hue: number) {
  const t0 = performance.now()
  const theme = buildTheme({ hue, neutral: "auto" })
  const t1 = performance.now()
  applyThemeToRoot(theme)
  const t2 = performance.now()
  getComputedStyle(document.documentElement).getPropertyValue("--primary")
  const t3 = performance.now()
  Object.assign(parts, { build: t1 - t0, apply: t2 - t1, recalc: t3 - t2 })
  return t3 - t0
}
// used by scripts/perf-example.ts
Object.assign(window, { __gennexUpdate: update, __gennexParts: parts })

/** Brand hue slider: rebuilds the theme from any hue and swaps the CSS variables with applyThemeToRoot. */
export function ThemeSlider() {
  const [hue, setHue] = useState(initialHue)
  const [ms, setMs] = useState<number[]>([])
  const frame = useRef(0)

  useEffect(() => {
    // one update per animation frame while dragging
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const t = update(hue)
      setMs((p) => [...p.slice(-29), t])
    })
    return () => cancelAnimationFrame(frame.current)
  }, [hue])

  const n = nameOfHue(hue)
  const sorted = [...ms].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="hue" className="justify-between">
        <span>Brand hue</span>
        <span className="font-mono text-xs text-muted-foreground">
          {hue}° {n.name}
        </span>
      </Label>
      <input
        id="hue"
        type="range"
        min={0}
        max={360}
        step={1}
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <span className="font-mono text-xs text-muted-foreground" data-testid="update-ms">
        update {ms.length ? ms[ms.length - 1].toFixed(1) : "-"} ms (median of last {ms.length}: {median.toFixed(1)} ms)
      </span>
    </div>
  )
}
