// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Suspense + error containment for a lazy-loaded section.
//
// Without an error boundary a rejected `lazy()` import propagates past
// Suspense to the router root, which unmounts the whole page and replaces
// it with the default "Something went wrong!" screen — one failed chunk
// fetch takes down the entire site, nav and content included. Wrapping
// each lazy body here keeps the blast radius at the section: the rest of
// the page stays interactive and the failed slot offers a reload.
//
// Pairs with `lib/chunkRecovery.ts`, which reloads automatically on the
// FIRST chunk failure in a tab. This boundary is what the user sees when
// that automatic recovery has already been spent and the chunk is still
// unreachable.

import { Component, type ErrorInfo, type ReactElement, type ReactNode, Suspense } from "react"

type LazyBoundaryProps = Readonly<{
  /** Rendered while the lazy chunk is in flight. */
  pending: ReactNode
  /** Human-readable name of the section, used in the failure message. */
  label: string
  children: ReactNode
}>

type LazyBoundaryState = Readonly<{ failed: boolean }>

function LazyFallback({ label }: { label: string }): ReactElement {
  return (
    <div className="mt-10 flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        The {label} could not be loaded. This usually means a new version was just deployed.
      </p>
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        onClick={() => {
          window.location.reload()
        }}
      >
        Reload the page
      </button>
    </div>
  )
}

/**
 * Error boundary + Suspense wrapper for a `lazy()`-loaded section.
 *
 * Catches both chunk-fetch failures and render-time throws from the lazy
 * body. Recovery is a full reload rather than a local retry, because
 * React's `lazy` memoizes the rejected promise and the browser's module
 * map memoizes the failed chunk URL — neither will re-attempt in place.
 */
export class LazyBoundary extends Component<LazyBoundaryProps, LazyBoundaryState> {
  override state: LazyBoundaryState = { failed: false }

  static getDerivedStateFromError(): LazyBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[chartlang] ${this.props.label} failed to load`, error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.failed) return <LazyFallback label={this.props.label} />
    return <Suspense fallback={this.props.pending}>{this.props.children}</Suspense>
  }
}
