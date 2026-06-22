// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Light/dark switch for the shadcn theme, wired to next-themes (the same
// source `sonner` + the editor read). Renders a neutral placeholder until
// mounted so the server-rendered icon never mismatches the client's resolved
// theme (a hydration warning otherwise).

import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

export function ThemeToggle(): ReactElement {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      aria-label="Toggle theme"
      data-testid="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon"
      title="Toggle light / dark theme"
      type="button"
      variant="ghost"
    >
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : <span className="size-4" />}
    </Button>
  )
}
