// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// TanStack Start server route — EODData symbol search + daily EOD fetch + quota
// usage. Declared with `server.handlers` (the same pattern as
// routes/api/{compile,scripts}.ts; `createServerFileRoute` is not exported by
// the installed @tanstack/react-start). This file is the ONLY importer of the
// server-only EODData layer (`src/lib/server/eod/*`), which is what keeps both
// the native db driver AND the `EODDATA_API_KEY` out of the client bundle.
// Components call the typed wrappers in src/lib/eodClient.ts, never this route.

import { createFileRoute } from "@tanstack/react-router"

import { getDailyBars, getUsage, searchSymbols } from "@/lib/server/eod/cache"
import {
  EodDataError,
  InvalidSymbolError,
  MissingApiKeyError,
  QuotaExceededError,
} from "@/lib/server/eod/types"

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

// POST body is `{ op, ...args }`; one route serves all three ops so the client
// needs a single endpoint (mirrors /api/scripts).
async function handlePost(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (body === null || typeof body !== "object") {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 })
  }
  const op = asString(body.op)

  switch (op) {
    case "search": {
      const query = asString(body.query) ?? ""
      return Response.json({ hits: await searchSymbols(query) })
    }
    case "load": {
      const symbol = asString(body.symbol)
      if (symbol === null) return Response.json({ error: "symbol is required" }, { status: 400 })
      return Response.json(await getDailyBars(symbol))
    }
    case "usage": {
      return Response.json({ usage: getUsage() })
    }
    default:
      return Response.json({ error: `unknown op: ${String(op)}` }, { status: 400 })
  }
}

// Map each typed error to a friendly status. Validation + missing-key failures
// are deliberately 4xx (the UI shows them inline); a spent quota is 429; an
// upstream EODData failure is 502.
function errorResponse(err: unknown): Response {
  if (err instanceof InvalidSymbolError) return Response.json({ error: err.message }, { status: 400 })
  if (err instanceof MissingApiKeyError) return Response.json({ error: err.message }, { status: 400 })
  if (err instanceof QuotaExceededError) return Response.json({ error: err.message }, { status: 429 })
  if (err instanceof EodDataError) return Response.json({ error: err.message }, { status: 502 })
  const message = err instanceof Error ? err.message : String(err)
  return Response.json({ error: message }, { status: 500 })
}

export const Route = createFileRoute("/api/eod")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          return await handlePost(request)
        } catch (err) {
          return errorResponse(err)
        }
      },
    },
  },
})
