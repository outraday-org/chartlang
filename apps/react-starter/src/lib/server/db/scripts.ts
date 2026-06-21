// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — saved-script CRUD over the Drizzle client. Imported by the
// `api/scripts.ts` server route only; components call the typed `fetch`
// wrappers in `src/lib/scriptsClient.ts`, never these functions directly.

import { desc, eq } from "drizzle-orm"

import { MAX_SOURCE_LENGTH } from "../constants"
import { getDb } from "./index"
import type { ScriptRow } from "./schema"
import { scripts } from "./schema"

/** Cheap sidebar list shape — no `source` (the full text is fetched lazily). */
export type ScriptMeta = Pick<ScriptRow, "id" | "name" | "symbol" | "updatedAt">

// The source cap is shared with the compile route via `../constants` so a
// script that compiles can always be saved (and vice-versa) — re-exported
// here for callers of the db layer.
export { MAX_SOURCE_LENGTH }

/** Thrown for caller-input failures; the route maps it to a 400. */
export class InvalidScriptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidScriptError"
  }
}

function assertValidName(name: string): void {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new InvalidScriptError("name is required")
  }
}

function assertSourceWithinCap(source: string): void {
  if (typeof source !== "string") {
    throw new InvalidScriptError("source is required")
  }
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new InvalidScriptError(`source exceeds ${MAX_SOURCE_LENGTH} bytes`)
  }
}

/** All scripts, newest-updated first, without their `source`. */
export function listScripts(): ScriptMeta[] {
  return getDb()
    .select({
      id: scripts.id,
      name: scripts.name,
      symbol: scripts.symbol,
      updatedAt: scripts.updatedAt,
    })
    .from(scripts)
    .orderBy(desc(scripts.updatedAt))
    .all()
}

/** A single script (full row incl. `source`), or `null` if not found. */
export function getScript(id: string): ScriptRow | null {
  const [row] = getDb().select().from(scripts).where(eq(scripts.id, id)).all()
  return row ?? null
}

/** Input to {@link saveScript}. Omitting `id` creates a new script. */
export type SaveScriptInput = {
  id?: string
  name: string
  source: string
  symbol?: string | null
}

/**
 * Upsert a script. New (no `id`) → generate an id + `createdAt`; existing →
 * overwrite name/source/symbol and bump `updatedAt`. `createdAt` is never
 * touched on update. Returns the persisted row.
 */
export function saveScript(input: SaveScriptInput): ScriptRow {
  assertValidName(input.name)
  assertSourceWithinCap(input.source)

  const db = getDb()
  const now = new Date()
  const id = input.id ?? crypto.randomUUID()
  const symbol = input.symbol ?? null

  db.insert(scripts)
    .values({
      id,
      name: input.name,
      source: input.source,
      symbol,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: scripts.id,
      set: { name: input.name, source: input.source, symbol, updatedAt: now },
    })
    .run()

  const saved = getScript(id)
  // The row was just written; this is unreachable in practice but keeps
  // the return type honest.
  if (!saved) throw new Error("saveScript: row vanished after write")
  return saved
}

/** Rename a script; returns the updated row, or `null` if no such id. */
export function renameScript(id: string, name: string): ScriptRow | null {
  assertValidName(name)
  getDb()
    .update(scripts)
    .set({ name, updatedAt: new Date() })
    .where(eq(scripts.id, id))
    .run()
  return getScript(id)
}

/** Delete a script. Returns `true` if a row was removed. */
export function deleteScript(id: string): boolean {
  const result = getDb().delete(scripts).where(eq(scripts.id, id)).run()
  return result.changes > 0
}
