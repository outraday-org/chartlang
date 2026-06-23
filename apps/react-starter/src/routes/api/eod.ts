// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// TanStack Start server route — daily EOD bar fetch. Declared with
// `server.handlers` (the same pattern as routes/api/{compile,scripts}.ts;
// `createServerFileRoute` is not exported by the installed @tanstack/react-start).
// This file is the ONLY importer of the server-only daily-bar layer
// (`src/lib/server/eod/*`), which keeps the native db driver out of the client
// bundle. Components call the typed wrappers in src/lib/eodClient.ts, never this
// route. The data source is Yahoo Finance (free, no API key, no quota).

import { createFileRoute } from "@tanstack/react-router"

import { getDailyBars } from "@/lib/server/eod/cache"
import { InvalidSymbolError, MarketDataError } from "@/lib/server/eod/types"

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

// POST body is `{ op, ...args }`; one route serves the load op (mirrors
// /api/scripts' single-endpoint shape so the client needs one URL).
async function handlePost(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (body === null || typeof body !== "object") {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 })
  }
  const op = asString(body.op)

  switch (op) {
    case "load": {
      const symbol = asString(body.symbol)
      if (symbol === null) return Response.json({ error: "symbol is required" }, { status: 400 })
      return Response.json(await getDailyBars(symbol))
    }
    default:
      return Response.json({ error: `unknown op: ${String(op)}` }, { status: 400 })
  }
}

// Map each typed error to a friendly status. A bad symbol is a 400 (the UI shows
// it inline); an upstream data-source failure is a 502.
function errorResponse(err: unknown): Response {
  if (err instanceof InvalidSymbolError) return Response.json({ error: err.message }, { status: 400 })
  if (err instanceof MarketDataError) return Response.json({ error: err.message }, { status: 502 })
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
