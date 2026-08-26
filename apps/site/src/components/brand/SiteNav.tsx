// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { Menu, X } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"

import { Logo } from "@/components/brand/Logo"
import { ThemeToggle } from "@/components/brand/ThemeToggle"

const DOCS_URL = "https://docs.chartlang.invinite.com"
const GITHUB_URL = "https://github.com/outraday-org/chartlang"

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#quickstart", label: "Quickstart" },
  { href: "/#demo", label: "Demo" },
  { href: "/converter", label: "PineScript Converter" },
  { href: DOCS_URL, label: "Docs" },
] as const

function GithubIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.2 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.33-1.74-1.33-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.16-.13-.3-.54-1.51.11-3.15 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.65 1.64.24 2.85.12 3.15.77.82 1.23 1.87 1.23 3.16 0 4.53-2.81 5.52-5.49 5.81.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  )
}

function isExternal(href: string): boolean {
  return href.startsWith("http")
}

/**
 * Site header navigation.
 *
 * The link row is a single non-wrapping line, so below `md` (768px) it is
 * wider than the viewport: the flex row overflowed the header, pushing the
 * logo off the left edge and clipping the theme toggle and GitHub icon off
 * the right with no way to scroll to them. Below `md` the links therefore
 * collapse into a disclosure panel behind a hamburger, mirroring how the
 * VitePress docs nav folds at its own breakpoint (see
 * `docs/.vitepress/theme/style.css`) so the two sites behave the same way on
 * a phone.
 *
 * The panel closes on route/hash navigation (every link is a plain anchor, so
 * a click is the signal), on Escape, and once the viewport grows past the
 * breakpoint — otherwise it would linger, invisible, while its links are also
 * rendered in the desktop row.
 */
export function SiteNav(): ReactElement {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false)
    }
    const desktop = window.matchMedia("(min-width: 768px)")
    function onBreakpoint(): void {
      if (desktop.matches) setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    desktop.addEventListener("change", onBreakpoint)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      desktop.removeEventListener("change", onBreakpoint)
    }
  }, [open])

  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
      <a href="/" className="flex shrink-0 items-center gap-2" aria-label="chartlang home">
        <Logo variant="full" />
      </a>

      {/* Desktop: the full row. */}
      <ul className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="transition-colors hover:text-foreground"
              {...(isExternal(link.href) ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
        <li className="flex items-center">
          <ThemeToggle />
        </li>
        <li className="flex items-center">
          <a
            href={GITHUB_URL}
            className="flex items-center transition-colors hover:text-foreground"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <GithubIcon />
          </a>
        </li>
      </ul>

      {/* Mobile: one button, and a panel that holds the same destinations. */}
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls="site-nav-mobile"
        aria-label={open ? "Close menu" : "Open menu"}
        className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          id="site-nav-mobile"
          className="absolute inset-x-0 top-full border-b border-border bg-background px-6 pb-4 shadow-lg md:hidden"
        >
          <ul className="flex flex-col text-sm text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border py-3 transition-colors hover:text-foreground"
                  {...(isExternal(link.href) ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-4">
            <ThemeToggle />
            <a
              href={GITHUB_URL}
              className="flex items-center gap-2 transition-colors hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon />
              <span className="text-sm text-muted-foreground">GitHub</span>
            </a>
          </div>
        </div>
      ) : null}
    </nav>
  )
}
