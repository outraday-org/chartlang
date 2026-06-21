// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// TanStack Start server route — saved-script CRUD. Declared with
// `server.handlers` (the same pattern as routes/api/compile.ts; the older
// `createServerFileRoute` helper is not exported by the installed
// @tanstack/react-start). This file is the ONLY importer of the
// server-only DB layer, which is what keeps `better-sqlite3` out of the
// client bundle. Components call the typed wrappers in
// src/lib/scriptsClient.ts, never this route directly.

import { createFileRoute } from "@tanstack/react-router"

import {
  InvalidScriptError,
  deleteScript,
  getScript,
  listScripts,
  renameScript,
  saveScript,
} from "@/lib/server/db/scripts"

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

// POST body is `{ op, ...args }`; one route handles all mutations so the
// client needs a single endpoint. Validation lives in the db layer
// (InvalidScriptError → 400); shape errors here also map to 400.
async function handlePost(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (body === null || typeof body !== "object") {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 })
  }
  const op = asString(body.op)

  switch (op) {
    case "get": {
      const id = asString(body.id)
      if (id === null) return Response.json({ error: "id is required" }, { status: 400 })
      return Response.json({ script: getScript(id) })
    }
    case "save": {
      const name = asString(body.name)
      const source = asString(body.source)
      if (name === null || source === null) {
        return Response.json({ error: "name and source are required" }, { status: 400 })
      }
      const id = asString(body.id)
      const symbol = asString(body.symbol)
      return Response.json({
        script: saveScript({ ...(id !== null && { id }), name, source, symbol }),
      })
    }
    case "rename": {
      const id = asString(body.id)
      const name = asString(body.name)
      if (id === null || name === null) {
        return Response.json({ error: "id and name are required" }, { status: 400 })
      }
      return Response.json({ script: renameScript(id, name) })
    }
    case "delete": {
      const id = asString(body.id)
      if (id === null) return Response.json({ error: "id is required" }, { status: 400 })
      return Response.json({ deleted: deleteScript(id) })
    }
    default:
      return Response.json({ error: `unknown op: ${String(op)}` }, { status: 400 })
  }
}

export const Route = createFileRoute("/api/scripts")({
  server: {
    handlers: {
      GET: () => Response.json({ scripts: listScripts() }),
      POST: async ({ request }: { request: Request }) => {
        try {
          return await handlePost(request)
        } catch (err) {
          if (err instanceof InvalidScriptError) {
            return Response.json({ error: err.message }, { status: 400 })
          }
          const message = err instanceof Error ? err.message : String(err)
          return Response.json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
