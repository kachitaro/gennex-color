import { useEffect, useRef, useState } from "react"
import { applyThemeToRoot, buildTheme, nameOfHue } from "gennex-color"

import { Label } from "@/components/ui/label"

const initialHue = () => {
  const h = Number(new URLSearchParams(window.location.search).get("hue"))
  return Number.isFinite(h) && h >= 0 && h <= 360 ? h : 255
}

/** Brand hue slider: rebuilds the theme from any hue and swaps the CSS variables with applyThemeToRoot. */
export function ThemeSlider() {
  const [hue, setHue] = useState(initialHue)
  const frame = useRef(0)

  useEffect(() => {
    // one update per animation frame while dragging; buildTheme is ~5 ms
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => applyThemeToRoot(buildTheme({ hue, neutral: "auto" })))
    return () => cancelAnimationFrame(frame.current)
  }, [hue])

  const n = nameOfHue(hue)
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
    </div>
  )
}
