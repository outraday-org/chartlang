// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { Logo } from "@/components/brand/Logo"
import appCss from "../styles.css?url"
import faviconSvg from "../../../../brand/chartlang_logo.svg?url"
import faviconIco from "../../../../brand/chartlang_logo.ico?url"
import iconPng48 from "../../../../brand/chartlang_logo_48.png?url"
import iconPng256 from "../../../../brand/chartlang_logo_256.png?url"
import appleTouchIcon from "../../../../brand/chartlang_logo_1024.png?url"
import ogImageUrl from "../../../../brand/chartlang_og.png?url"

const DOCS_URL = "https://docs.chartlang.invinite.com"
const GITHUB_URL = "https://github.com/outraday-org/chartlang"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "chartlang — open scripts for technical analysis" },
      {
        name: "description",
        content:
          "Open-source TypeScript eDSL for indicator, drawing, and alert scripts that run on any conforming chart adapter.",
      },
      { property: "og:title", content: "chartlang" },
      {
        property: "og:description",
        content: "Open scripts for technical analysis. Run anywhere.",
      },
      { property: "og:image", content: ogImageUrl },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: faviconSvg },
      { rel: "icon", type: "image/x-icon", href: faviconIco },
      { rel: "icon", type: "image/png", sizes: "48x48", href: iconPng48 },
      { rel: "icon", type: "image/png", sizes: "256x256", href: iconPng256 },
      { rel: "apple-touch-icon", sizes: "1024x1024", href: appleTouchIcon },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground">404</h1>
      <p className="mt-3 text-muted-foreground">The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#quickstart", label: "Quickstart" },
  { href: "#demo", label: "Demo" },
  { href: DOCS_URL, label: "Docs" },
] as const

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2" aria-label="chartlang home">
              <Logo variant="full" />
            </a>
            <ul className="flex items-center gap-6 text-sm text-muted-foreground">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={GITHUB_URL}
                  className="transition-colors hover:text-foreground"
                  aria-label="GitHub"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
            <span>© 2026 Invinite. MIT-licensed.</span>
            <a href={GITHUB_URL} className="transition-colors hover:text-foreground">
              Source on GitHub
            </a>
          </div>
        </footer>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
