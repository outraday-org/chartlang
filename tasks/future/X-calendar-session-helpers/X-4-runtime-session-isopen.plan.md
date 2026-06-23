# Task 4 — Runtime `session.isOpen` — Implementation Plan

## Context

`session.isOpen(t, spec, tz?): boolean` answers whether epoch `t` falls inside
the daily `"HH:MM-HH:MM"` / `"HHMM-HHMM"` window `spec`, interpreted in `tz`
(default `syminfo.timezone`, fallback `"UTC"`), using the same UTC + fixed-offset
determinism machinery Task 2 installed for `time.*`. The window-parse grammar
already exists privately in `sessionVolumeProfile.ts`; this task lifts it into a
shared module so both consumers share one source of truth, then builds the real
runtime `session` namespace and installs it on `ComputeContext`, replacing the
core sentinel hole.

## Pre-existing work (verified)

- **Core hole.** `packages/core/src/time-accessors/sessionAccessors.ts` exports
  `session` (frozen, `isOpen(_t, _spec, _tz?)` throws the active-step sentinel)
  and `type SessionNamespace = typeof session`. Registered `slot: false` at
  `packages/core/src/statefulPrimitives.ts:218` (`session.isOpen`). Barrel:
  `packages/core/src/time-accessors/index.ts:5`, root `index.ts:221`.
  `ComputeContext.session: SessionNamespace` (`core/src/types.ts:796`).
- **Primitives hole re-export.** `packages/runtime/src/primitives.ts:37`
  re-exports `session` from `@invinite-org/chartlang-core` (the throwing hole)
  with a "real impl lands in Task 4" comment.
- **Install site.** `packages/runtime/src/buildComputeContext.ts:47` installs
  that hole as `session`. `time` is built at `:46` via
  `buildTimeNamespace(state.runtimeContext)`.
- **Task 2 machinery to reuse (do NOT duplicate):**
  - `time-accessors/civil.ts` → `splitEpoch(ms, offsetMin)` returns
    `{ y, m, d, hh, mm, ss, dow }`.
  - `time-accessors/tzOffset.ts` → `resolveOffsetMinutes(tz)` →
    `{ offsetMin, dstUnsupported }`.
  - `time-accessors/timeAccessors.ts` → the `resolveTz` fallback chain and the
    `buildTimeNamespace` dedup pattern over `ctx.diagnosedTzKeys` keyed
    `tz-dst-unsupported|<tz>`.
  - `RuntimeContext.diagnosedTzKeys` (`runtimeContext.ts:290`) is the SHARED
    dedup set — binding `session`'s `onDstUnsupported` to the same set means a
    script using both `time.*` and `session.isOpen` on one DST zone warns once
    total.
- **Unlifted parser.** `parseSessionWindowMinutes(session)` lives ONLY at
  `sessionVolumeProfile.ts:85`, returning `{ startMinutes, endMinutes } | null`.

## Issues / decisions

1. **Field-name divergence.** The task file's illustrative signature returns
   `{ startMin, endMin }`, but the existing consumer uses
   `{ startMinutes, endMinutes }`. To keep `sessionVolumeProfile` byte-identical
   (no internal rename, minimal diff), the shared helper keeps the EXISTING
   `{ startMinutes, endMinutes }` names. The grammar/regex is moved verbatim.
2. **No parser fork.** `sessionVolumeProfile.ts` deletes its local copy and
   imports `parseSessionWindowMinutes` from `../time-accessors/sessionWindow.js`.
   Goldens/properties for sessionVolumeProfile must stay green (regex + range
   checks unchanged).
3. **Diagnostic scope.** Per the task's "keep v1 minimal" allowance, a malformed
   spec returns `false` with NO new diagnostic code (avoids registering a new
   code in the Task-2 union/allowlist). `onMalformedSpec` is therefore NOT part
   of the factory — keeps the surface tight. Reuses only `tz-dst-unsupported`.
4. **DST fires before membership.** `isOpen` resolves the offset (firing
   `onDstUnsupported` on a DST zone, falling back to offset 0) regardless of
   whether `t` is finite or `spec` is parseable, matching how `time.*`'s
   `offsetFor` runs first — consistent with the shared dedup contract.
   Actually: parse-first is cheaper and the task orders "non-finite t → false"
   and "malformed spec → false" before offset resolution. Decision: follow the
   task's order — non-finite `t` → `false`, then parse (`null` → `false`), THEN
   resolve offset + membership. A DST diagnostic only fires once the call is
   otherwise well-formed; this is acceptable (the task's onDstUnsupported step is
   listed after parse). Document this ordering in the JSDoc.
5. **Half-open + wrap.** `[start, end)`; `end <= start` ⇒ wrap
   `[start, 1440) ∪ [0, end)`. `start === end` (e.g. `"0930-0930"`) is a wrap
   window covering the whole day under the wrap rule — matches `[start,1440)∪[0,start)`
   = all minutes except none excluded... resolves to every minute. Tested.

## Steps

1. **Create `time-accessors/sessionWindow.ts`** — MIT header, exported
   `parseSessionWindowMinutes(spec: string): { startMinutes; endMinutes } | null`
   (regex + range checks lifted verbatim from sessionVolumeProfile), full JSDoc.
2. **Modify `ta/sessionVolumeProfile.ts`** — delete the local
   `parseSessionWindowMinutes`; import it from `../time-accessors/sessionWindow.js`.
3. **Create `time-accessors/sessionAccessors.ts`** —
   `createSessionNamespace(getDefaultTz, onDstUnsupported): SessionNamespace`
   (frozen `{ isOpen }`) + `buildSessionNamespace(ctx)` binding `getDefaultTz` to
   `ctx.views.syminfo.timezone` and `onDstUnsupported` to the SAME
   `ctx.diagnosedTzKeys` dedup + `pushDiagnostic` as `buildTimeNamespace`.
   Reuse `resolveOffsetMinutes`, `splitEpoch`, and a `resolveTz` helper (lift the
   tiny `resolveTz` to a shared spot OR re-declare — see step 3a).
   - 3a. `resolveTz` is currently a private fn in `timeAccessors.ts`. To avoid a
     fork, export it from `timeAccessors.ts` (or move to a small shared spot) and
     import it into `sessionAccessors.ts`. Decision: export `resolveTz` from
     `timeAccessors.ts` and re-export via the barrel (covered by tests already on
     the time path). Minimal, no behavior change.
4. **Modify `time-accessors/index.ts`** — export `buildSessionNamespace`,
   `createSessionNamespace`, `parseSessionWindowMinutes`, (and `resolveTz` if
   exported).
5. **Modify `primitives.ts`** — drop the core-hole `session` re-export; instead
   note `session` is built per-mount like `time` (no module-level export, since
   it closes over `ctx`).
6. **Modify `buildComputeContext.ts`** — import `buildSessionNamespace`; remove
   `session` from the `./primitives.js` import; install
   `session: buildSessionNamespace(state.runtimeContext)` right after `time`.
7. **Tests** — `sessionWindow.test.ts` (all parse branches) +
   `sessionAccessors.test.ts` (membership, half-open boundary, wrap, fixed-offset
   tz shift, DST fallback + shared dedup, malformed → false, non-finite → false,
   default-tz path). 100% coverage.
8. Update runtime `CLAUDE.md` with the shared-parser + session-install invariant.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/time-accessors/sessionWindow.ts` | Create | Shared `"HH:MM-HH:MM"` parser (one source of truth). |
| `packages/runtime/src/time-accessors/sessionWindow.test.ts` | Create | Parser branch coverage. |
| `packages/runtime/src/time-accessors/sessionAccessors.ts` | Create | `createSessionNamespace` + `buildSessionNamespace`. |
| `packages/runtime/src/time-accessors/sessionAccessors.test.ts` | Create | Membership / wrap / tz / DST / malformed / non-finite. |
| `packages/runtime/src/time-accessors/timeAccessors.ts` | Modify | Export `resolveTz` for reuse. |
| `packages/runtime/src/time-accessors/index.ts` | Modify | Barrel the new session exports. |
| `packages/runtime/src/ta/sessionVolumeProfile.ts` | Modify | Import the shared parser (delete local copy). |
| `packages/runtime/src/primitives.ts` | Modify | Drop the core-hole `session` re-export. |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Install real `session`. |
| `packages/runtime/CLAUDE.md` | Modify | Document the shared-parser + session-install invariant. |

## Gates

- `pnpm --filter @invinite-org/chartlang-runtime test` (100% coverage incl.
  re-run sessionVolumeProfile golden/property).
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`.

## Changeset

Already covered — `.changeset/calendar-session-helpers.md` lists runtime (minor)
and its body already names `session.isOpen`. No edit needed.

## Acceptance criteria

- `session.isOpen` works (no longer the throwing hole); half-open + wrap-aware;
  UTC + fixed-offset; malformed spec / non-finite `t` → `false`.
- Shared parser; sessionVolumeProfile goldens/properties unchanged.
- `session` installed on `ComputeContext`; shares `tz-dst-unsupported` dedup
  with `time.*`.
- Runtime coverage 100%; typecheck/lint/docs:check green.
