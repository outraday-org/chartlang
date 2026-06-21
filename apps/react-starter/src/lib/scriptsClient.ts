// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Browser-safe typed wrappers over the /api/scripts server route. The UI
// (Task 6's ScriptsSidebar + load/save flow) imports ONLY this module —
// never src/lib/server/* — so the native DB driver never reaches the
// client bundle.

/** Sidebar list shape — no `source` (fetched lazily via {@link getScript}). */
export type ScriptMeta = {
  id: string
  name: string
  symbol: string | null
  updatedAt: Date
}

/** A full persisted script, incl. its `source`. */
export type ScriptRecord = ScriptMeta & {
  source: string
  createdAt: Date
}

// The server route serializes `Date` columns as ISO strings (JSON); revive
// them so callers get real `Date`s, matching the server-side row types.
type RawMeta = Omit<ScriptMeta, "updatedAt"> & { updatedAt: string }
type RawRecord = Omit<ScriptRecord, "updatedAt" | "createdAt"> & {
  updatedAt: string
  createdAt: string
}

function reviveMeta(raw: RawMeta): ScriptMeta {
  return { ...raw, updatedAt: new Date(raw.updatedAt) }
}

function reviveRecord(raw: RawRecord): ScriptRecord {
  return { ...raw, createdAt: new Date(raw.createdAt), updatedAt: new Date(raw.updatedAt) }
}

async function postOp<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/scripts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `request failed (${res.status})`)
  }
  return data as T
}

/** List saved scripts, newest-updated first (without their source). */
export async function listScripts(): Promise<ScriptMeta[]> {
  const res = await fetch("/api/scripts")
  if (!res.ok) throw new Error(`failed to list scripts (${res.status})`)
  const { scripts } = (await res.json()) as { scripts: RawMeta[] }
  return scripts.map(reviveMeta)
}

/** Load a full script by id, or `null` if it no longer exists. */
export async function getScript(id: string): Promise<ScriptRecord | null> {
  const { script } = await postOp<{ script: RawRecord | null }>({ op: "get", id })
  return script ? reviveRecord(script) : null
}

/** Create or update a script (omit `id` to create). Returns the saved row. */
export async function saveScript(input: {
  id?: string
  name: string
  source: string
  symbol?: string | null
}): Promise<ScriptRecord> {
  const { script } = await postOp<{ script: RawRecord }>({ op: "save", ...input })
  return reviveRecord(script)
}

/** Rename a script; returns the updated row, or `null` if no such id. */
export async function renameScript(id: string, name: string): Promise<ScriptRecord | null> {
  const { script } = await postOp<{ script: RawRecord | null }>({ op: "rename", id, name })
  return script ? reviveRecord(script) : null
}

/** Delete a script. Resolves to `true` if a row was removed. */
export async function deleteScript(id: string): Promise<boolean> {
  const { deleted } = await postOp<{ deleted: boolean }>({ op: "delete", id })
  return deleted
}
