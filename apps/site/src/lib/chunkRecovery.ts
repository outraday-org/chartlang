// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Recovery for failed lazy-chunk fetches.
//
// Every `lazy(() => import(...))` on this site resolves to a
// content-hashed file under `/assets`. Those files are fronted by a CDN
// edge, so a chunk request can fail transiently — an edge asking for a
// just-deployed hash before the origin has propagated it, a tab left open
// across a deploy that now names chunks the browser will never find, or a
// plain network blip mid-fetch. The browser surfaces all of them the same
// way: `TypeError: Failed to fetch dynamically imported module`.
//
// A retry is not enough on its own: the HTML module map records the
// failure against the chunk URL, so re-calling `import()` with the same
// specifier re-throws without a second network request. The only reliable
// recovery is a full document reload, which re-fetches the SSR HTML and
// with it the current chunk names.
//
// Vite's `__vitePreload` helper dispatches a cancelable `vite:preloadError`
// on `window` before rethrowing, which is the hook we listen on. We do NOT
// call `preventDefault()`: suppressing the throw makes the import resolve
// to `undefined` and React renders a broken element instead of failing.
// Let it throw, and reload out from under it.

const RELOAD_GUARD_KEY = "chartlang-chunk-reload"

/**
 * Whether a chunk-failure reload has already been attempted in this tab.
 *
 * Guards against a reload loop when the chunk is genuinely gone (a rolled
 * back deploy, an adblocker eating the request): the first failure
 * reloads, a second failure in the same session falls through to the
 * nearest {@link LazyBoundary}, which renders a visible message.
 * `sessionStorage` can throw in locked-down privacy modes, so every access
 * is guarded — an unreadable store degrades to "never reload", never to a
 * loop.
 */
function reloadAlreadyAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(RELOAD_GUARD_KEY) !== null
  } catch {
    return true
  }
}

function markReloadAttempted(): boolean {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
    return true
  } catch {
    return false
  }
}

/**
 * Clear the one-shot reload guard.
 *
 * Called once the app has mounted and stayed up long enough to be
 * considered healthy, so a chunk failure hours later in the same tab still
 * gets its one automatic reload.
 */
export function clearChunkReloadGuard(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY)
  } catch {
    // Nothing to clear if the store is unavailable.
  }
}

/**
 * Subscribe to `vite:preloadError` and reload once on the first failure.
 *
 * Returns an unsubscribe function suitable for a `useEffect` cleanup.
 * Client-only — `window` is touched eagerly, so call it from an effect,
 * never during a server render.
 */
export function installChunkRecovery(): () => void {
  const onPreloadError = (): void => {
    if (reloadAlreadyAttempted()) return
    if (!markReloadAttempted()) return
    window.location.reload()
  }

  window.addEventListener("vite:preloadError", onPreloadError)
  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError)
  }
}
