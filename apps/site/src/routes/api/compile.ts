// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// TanStack Start server route → Netlify Function. Runs the real
// chartlang compiler in Node (esbuild + node:* available in the
// function runtime). The browser keeps the esbuild/node:* stubs, so
// this is the only path that touches the real compiler.
//
// Declared with `server.handlers` rather than the older
// `createServerFileRoute` helper, which the installed
// @tanstack/react-start (1.168) no longer exports.

import { createFileRoute } from "@tanstack/react-router"

import { handleCompile } from "@/lib/server/compile"

function extractSource(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null
  const candidate = (body as { source?: unknown }).source
  return typeof candidate === "string" ? candidate : null
}

const PRODUCTION_ORIGIN = "https://chartlang.invinite.com"

// The compile endpoint is public; lock cross-origin POSTs to the
// production domain, Netlify deploy previews (`*.netlify.app`), and
// same-origin requests (the embedded demo, plus localhost during e2e /
// dev). A missing Origin header (curl, server-to-server) is allowed —
// there is nothing to reject. `host` is the request's own authority, so
// matching it covers same-origin without hardcoding every dev/preview
// host.
function isAllowedOrigin(origin: string | null, host: string | null): boolean {
  if (origin === null) return true
  if (origin === PRODUCTION_ORIGIN) return true
  let hostname: string
  try {
    hostname = new URL(origin).hostname
  } catch {
    return false
  }
  if (hostname.endsWith(".netlify.app")) return true
  return host !== null && origin.endsWith(`//${host}`)
}

export const Route = createFileRoute("/api/compile")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!isAllowedOrigin(request.headers.get("origin"), request.headers.get("host"))) {
          return Response.json({ ok: false, error: "Forbidden origin" }, { status: 403 })
        }
        const body = (await request.json().catch(() => null)) as unknown
        const source = extractSource(body)
        if (source === null) {
          return Response.json(
            { ok: false, error: "Request body must be JSON: { source: string }" },
            { status: 400 },
          )
        }
        try {
          const result = await handleCompile(source)
          return Response.json(result)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return Response.json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
