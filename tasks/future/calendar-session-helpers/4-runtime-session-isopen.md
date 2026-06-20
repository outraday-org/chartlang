# Task 4 — Runtime `session.isOpen` helper

> **Status: TODO**

## Goal

Implement `session.isOpen(t, spec, tz?)` at runtime by **lifting the
`sessionVolumeProfile` `"HH:MM-HH:MM"` parser into a shared helper** and testing
membership of `t`'s local-minute-of-day against the parsed window, using the
same UTC + fixed-offset machinery as the `time.*` accessors (Task 2). Install
the frozen `session` namespace on `ComputeContext`. Keep the runtime gates
green.

## Prerequisites

Task 1 (`SessionNamespace` + `session.isOpen` hole + `slot: false` registry +
shim), Task 2 (the `time-accessors/` civil + tzOffset machinery), Task 3
(`input.session` produces the `spec` strings authors pass in).

## Current Behavior

- `parseSessionWindowMinutes(session)`
  (`packages/runtime/src/ta/sessionVolumeProfile.ts:85`) parses `"HH:MM-HH:MM"`
  / `"HHMM-HHMM"` via `^(\d{1,2})(?::?(\d{2}))?\s*-\s*(\d{1,2})(?::?(\d{2}))?$`
  into start/end minute-of-day, returning `null` on malformed input, and the
  caller emits a `session-info-missing` diagnostic on fallback (`:111-119`).
- This parser is **private** to `sessionVolumeProfile.ts`.
- The `session` namespace is not yet installed on `ComputeContext`
  (Task 2 left a placeholder).

## Desired Behavior

- `session.isOpen(t, spec, tz?)` returns `true` iff `t`'s local minute-of-day
  (in the resolved zone, UTC + fixed-offset per Task 2) falls in the half-open
  `[start, end)` window parsed from `spec`.
- A window that wraps midnight (`end <= start`, e.g. `"2200-0400"`) is treated
  as `[start, 1440) ∪ [0, end)`.
- A malformed `spec` → `false` (and, optionally, a once-per-`spec`
  `session-spec-malformed` diagnostic — reuse the `time.*` dedup set pattern;
  keep it lightweight).
- `tz` resolves exactly as `time.*` does (explicit → `syminfo.timezone` →
  `"UTC"`; DST zone → UTC + the shared `tz-dst-unsupported` diagnostic).
- Non-finite `t` → `false`.

## Requirements

### 1. Shared session-window parser (`packages/runtime/src/time-accessors/sessionWindow.ts`, new)

Extract `parseSessionWindowMinutes` out of `sessionVolumeProfile.ts` into this
shared module (single source of truth for the window grammar):

```ts
export function parseSessionWindowMinutes(
    spec: string,
): { startMin: number; endMin: number } | null;
```

Then **re-import it in `sessionVolumeProfile.ts`** so the existing behavior is
byte-identical (do not duplicate the regex). Re-run the `sessionVolumeProfile`
golden + property tests to prove no drift.

### 2. `session.isOpen` impl (`packages/runtime/src/time-accessors/sessionAccessors.ts`, new)

A factory `createSessionNamespace(getDefaultTz, onDstUnsupported,
onMalformedSpec): SessionNamespace`:

- `isOpen(t, spec, tz?)`:
  - non-finite `t` → `false`.
  - `parse = parseSessionWindowMinutes(spec)`; `null` → `onMalformedSpec(spec)`
    once + return `false`.
  - resolve offset via `resolveOffsetMinutes(tz ?? getDefaultTz())`
    (Task 2), fire `onDstUnsupported` on a DST zone.
  - compute local minute-of-day from `splitEpoch(t, offsetMin)`
    (`hh*60 + mm`), then membership (wrap-aware as above).

Frozen, stateless (context bound at install time, like `time`).

### 3. Install on `ComputeContext` (`buildComputeContext.ts`)

Add `buildSessionNamespace(state.runtimeContext)` and put
`session: buildSessionNamespace(state.runtimeContext)` on the `base` object,
right after the Task-2 `time` field. Bind `getDefaultTz` /
`onDstUnsupported` to the **same** dedup state Task 2 used (so a script using
both `time.*` and `session.isOpen` on a DST zone fires `tz-dst-unsupported`
once total).

### 4. Diagnostic codes

- Reuse `tz-dst-unsupported` (Task 2).
- Optionally register `session-spec-malformed` (warning) the same way; if you
  prefer to keep v1 minimal, `isOpen` may simply return `false` on a malformed
  spec with no diagnostic — but if you add the code, register it in the same
  union/allowlist Task 2 touched.

### 5. Tests (co-located; 100% coverage)

- `sessionWindow.test.ts`: every parse branch (`HH:MM`, `HHMM`, single-digit
  hour, whitespace, malformed → `null`).
- `sessionAccessors.test.ts`: membership inside / outside a normal window; the
  half-open boundary (`start` inclusive, `end` exclusive); a midnight-wrap
  window; a fixed-offset tz shifting membership; a DST zone falling back to UTC
  (+ shared dedup); malformed spec → `false`; non-finite `t` → `false`.
- Regression: `sessionVolumeProfile` golden + property tests still pass after
  the parser extraction (prove byte-identical).

## Edge cases

- Half-open `[start, end)` matches `sessionVolumeProfile` and Pine `time()`
  in-session semantics — `end` minute itself is OUT.
- Midnight-wrap (`"2200-0400"`) — explicitly tested.
- A spec equal to `syminfo.session` is the common case; but `isOpen` takes the
  spec as an explicit argument (often from `input.session`), so it does NOT
  read `syminfo.session` itself — the caller passes it. (Document this contrast
  with `ta.sessionVolumeProfile`, which DOES default to `syminfo.session`.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/time-accessors/sessionWindow.ts` | Create | Shared `"HH:MM-HH:MM"` parser. |
| `packages/runtime/src/ta/sessionVolumeProfile.ts` | Modify | Re-import the shared parser (remove the local copy). |
| `packages/runtime/src/time-accessors/sessionAccessors.ts` | Create | `createSessionNamespace` + `buildSessionNamespace`. |
| `packages/runtime/src/time-accessors/*.test.ts` | Create | Parser + membership tests. |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Install `session` on `ComputeContext`. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**, incl. the
  re-run `sessionVolumeProfile` golden/property)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset.

## Acceptance Criteria

- `session.isOpen(t, spec, tz?)` correctly tests half-open membership, wrap-aware,
  UTC + fixed-offset; malformed spec / non-finite `t` → `false`.
- The `"HH:MM-HH:MM"` parser is shared with `sessionVolumeProfile` (no fork);
  the profile's goldens/properties are unchanged.
- `session` installed on `ComputeContext`; shares the `tz-dst-unsupported`
  dedup with `time.*`.
- Runtime coverage 100%; typecheck/lint/docs:check green.
