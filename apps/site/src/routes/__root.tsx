// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { Logo } from "@/components/brand/Logo"
import { ThemeToggle } from "@/components/brand/ThemeToggle"
import appCss from "../styles.css?url"
import faviconSvg from "../../../../brand/chartlang_logo.svg?url"
import faviconIco from "../../../../brand/chartlang_logo.ico?url"
import iconPng48 from "../../../../brand/chartlang_logo_48.png?url"
import iconPng256 from "../../../../brand/chartlang_logo_256.png?url"
import appleTouchIcon from "../../../../brand/chartlang_logo_1024.png?url"
import ogImageUrl from "../../../../brand/chartlang_og.png?url"

const DOCS_URL = "https://docs.chartlang.invinite.com"
const GITHUB_URL = "https://github.com/outraday-org/chartlang"

// Runs before first paint to set the theme class from a saved choice or the
// OS preference, avoiding a light/dark flash on SSR hydration.
const THEME_INIT = `(()=>{try{var t=localStorage.getItem("chartlang-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){document.documentElement.classList.add("dark")}})()`

function GithubIcon() {
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
  { href: "/#features", label: "Features" },
  { href: "/#quickstart", label: "Quickstart" },
  { href: "/#demo", label: "Demo" },
  { href: "/converter", label: "PineScript Converter" },
  { href: DOCS_URL, label: "Docs" },
] as const

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static no-flash theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body>
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2" aria-label="chartlang home">
              <Logo variant="full" />
            </a>
            <ul className="flex items-center gap-6 text-sm text-muted-foreground">
              {NAV_LINKS.map((link) => {
                const external = link.href.startsWith("http")
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                )
              })}
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
