// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from apps/site/src/routes/api/compile.ts. TanStack Start server
// route that runs the real chartlang compiler in Node (esbuild + node:*
// available in the server runtime). The browser keeps the esbuild/node:*
// stubs, so this is the only path that touches the real compiler.
//
// Declared with `server.handlers` rather than the older
// `createServerFileRoute` helper, which the installed
// @tanstack/react-start no longer exports.

import { createFileRoute } from "@tanstack/react-router"

import { handleCompile } from "@/lib/server/compile"

function extractSource(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null
  const candidate = (body as { source?: unknown }).source
  return typeof candidate === "string" ? candidate : null
}

// The compile endpoint is public. The starter is a local app with no
// fixed production origin, so we lock cross-origin POSTs to same-origin
// only (the request's own authority) plus missing-Origin requests (curl,
// server-to-server — there is nothing to reject). `host` is the request's
// own authority, so matching it covers same-origin without hardcoding any
// host. NOTE for deployers: once you deploy this app behind a known
// domain, tighten this — allow only your production origin(s) here.
function isAllowedOrigin(origin: string | null, host: string | null): boolean {
  if (origin === null) return true
  try {
    new URL(origin)
  } catch {
    return false
  }
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
