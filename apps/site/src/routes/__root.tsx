// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { useEffect } from "react"

import { SiteNav } from "@/components/brand/SiteNav"
import { clearChunkReloadGuard, installChunkRecovery } from "@/lib/chunkRecovery"
import appCss from "../styles.css?url"
import faviconIco from "../../../../brand/chartlang_logo.ico?url"
import iconPng48 from "../../../../brand/chartlang_logo_48.png?url"
import iconPng256 from "../../../../brand/chartlang_logo_256.png?url"
import appleTouchIcon from "../../../../brand/chartlang_logo_1024.png?url"
import ogImageUrl from "../../../../brand/chartlang_og.png?url"

const GITHUB_URL = "https://github.com/outraday-org/chartlang"

// Runs before first paint to set the theme class from a saved choice or the
// OS preference, avoiding a light/dark flash on SSR hydration.
const THEME_INIT = `(()=>{try{var t=localStorage.getItem("chartlang-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){document.documentElement.classList.add("dark")}})()`

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

// How long the app must stay up before a chunk failure is treated as a new
// incident rather than a repeat of the one we already reloaded for.
const CHUNK_GUARD_RESET_MS = 10_000

function RootDocument({ children }: { children: React.ReactNode }) {
  // Client-only: a failed `lazy()` chunk fetch is recovered by reloading the
  // document, which re-reads the SSR HTML and with it the current chunk
  // hashes. See lib/chunkRecovery.ts for why a retry in place cannot work.
  useEffect(() => {
    const uninstall = installChunkRecovery()
    const reset = window.setTimeout(clearChunkReloadGuard, CHUNK_GUARD_RESET_MS)
    return () => {
      uninstall()
      window.clearTimeout(reset)
    }
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static no-flash theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body>
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <SiteNav />
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
