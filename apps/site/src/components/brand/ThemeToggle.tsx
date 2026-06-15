// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { Moon, Sun } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"

const STORAGE_KEY = "chartlang-theme"

/**
 * Pill switch that flips the root `.dark` class and persists the choice to
 * localStorage. The initial (pre-mount) render is deterministic so it matches
 * the SSR markup; the real theme is read from the document on mount, after the
 * inline no-flash script in `__root.tsx` has already set the class.
 */
export function ThemeToggle(): ReactElement {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
    setMounted(true)
  }, [])

  function toggle(): void {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
    } catch {
      // Private-mode / blocked storage — toggle still works for the session.
    }
  }

  const dark = mounted ? isDark : true

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mounted ? isDark : undefined}
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="relative inline-flex h-6 w-11 items-center rounded-full border border-border bg-muted transition-colors hover:border-foreground/30"
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform ${
          dark ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      >
        {dark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
      </span>
    </button>
  )
}
