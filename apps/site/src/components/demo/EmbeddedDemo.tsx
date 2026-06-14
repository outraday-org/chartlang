// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Landing-page wrapper for the live editor + chart demo. Anchored at
// `#demo` (the nav link from Task 2 scrolls here). The heavy body
// (CodeMirror + the canvas2d adapter + the `/api/compile` fetch loop)
// is both lazy-loaded and client-only: TanStack Start renders the page
// on the server, where `fetch("/api/compile")` and the canvas have no
// business running, so we render a static placeholder during SSR and
// swap in the live demo once mounted.

import { type ReactElement, Suspense, lazy, useEffect, useState } from "react"

import "./demo.css"

const DemoBody = lazy(() => import("./DemoBody"))

function DemoPlaceholder(): ReactElement {
  return (
    <div className="mt-10 flex min-h-[640px] items-center justify-center rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
      Loading the live demo…
    </div>
  )
}

/**
 * Embedded demo section. Mounts below Quickstart on the home route and
 * carries `id="demo"` so the header nav anchor resolves to it.
 */
export function EmbeddedDemo(): ReactElement {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section id="demo" className="py-20 md:py-28">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">See it in action</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Edit a script on the left and watch it compile and render on the right.
        Press Play to stream live bars through the same runtime your chart would.
      </p>

      {mounted ? (
        <Suspense fallback={<DemoPlaceholder />}>
          <DemoBody />
        </Suspense>
      ) : (
        <DemoPlaceholder />
      )}
    </section>
  )
}
