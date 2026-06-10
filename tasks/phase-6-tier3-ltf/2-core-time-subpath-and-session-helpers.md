# Core: `time` subpath + session helpers port

> **Status: TODO**

## Goal

Ship the `@invinite-org/chartlang-core/time` subpath with the full
Phase-6 session/timezone helper surface — `session.regular`,
`session.extended`, `session.isOpen`, `weekday`, `nyDayKey`,
`nySessionBounds`, `weekKey`, `SessionType`, `SessionBounds`. Two
files port from `../invinite/`: `ny-day-key.ts` and
`session-boundaries.ts`. All helpers are pure functions over `Time`
with an explicit `tz: string` parameter — no implicit global TZ.

## Prerequisites

- Task 1 completed (`IntervalDescriptor.intervalSeconds?` +
  `intervalToSeconds` shipped — not strictly required by this task,
  but Task 1's PR landed first).

## Current Behavior

`@invinite-org/chartlang-core` exports `.` only. No `./time` subpath.
No `packages/core/src/time/` directory. Scripts that need session-day
boundaries either inline `Intl.DateTimeFormat` themselves or — more
commonly — depend on an indicator (e.g. VWAP) that did so internally
in Phase 5.

## Desired Behavior

`@invinite-org/chartlang-core/time` subpath ships from
`packages/core/src/time/` and exports:

```ts
export type SessionType = "regular" | "extended";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun … Sat

export type SessionBounds = {
  readonly startMs: number; // Unix ms
  readonly endMs: number;   // Unix ms (exclusive)
};

export const session: {
  readonly regular: (tz: string, t: Time) => SessionBounds | null;
  readonly extended: (tz: string, t: Time) => SessionBounds | null;
  readonly isOpen: (tz: string, t: Time, type: SessionType) => boolean;
};

export function weekday(tz: string, t: Time): Weekday;
export function nyDayKey(t: Time): string;          // "YYYY-MM-DD"
export function nySessionBounds(t: Time): SessionBounds;
export function weekKey(tz: string, t: Time): string; // ISO-week "GGGG-Www"
```

Every helper is a pure function over `Time` (no shared state apart
from an internal `Map<string, Intl.DateTimeFormat>` cache keyed by
`tz`). The cache is opaque to callers; the helpers are deterministic.

Adapters / scripts import via:

```ts
import { session, nyDayKey, weekKey, weekday } from "@invinite-org/chartlang-core/time";
```

The main package barrel (`@invinite-org/chartlang-core`) does **not**
re-export from `/time` — keeps the main barrel lean. Adapters that
need session helpers opt into the subpath explicitly.

## Requirements

### 1. Scaffold `packages/core/src/time/`

Create the directory with:

```
packages/core/src/time/
  CLAUDE.md
  index.ts
  types.ts
  nyDayKey.ts
  sessionBoundaries.ts
  weekday.ts
  weekKey.ts
  session.ts
  _lib/
    dateTimeFormatCache.ts
  *.test.ts (co-located)
  *.golden.test.ts (co-located)
```

`CLAUDE.md` documents the port convention (provenance header, `tz`
parameter contract, DST safety, `Intl.DateTimeFormat` cache key
shape). Mirrors the existing `packages/runtime/src/ta/CLAUDE.md`
style.

### 2. `packages/core/src/time/types.ts`

Export the three new types:

```ts
import type { Time } from "../types.js";

export type SessionType = "regular" | "extended";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SessionBounds = {
  readonly startMs: number;
  readonly endMs: number;
};
```

### 3. `packages/core/src/time/_lib/dateTimeFormatCache.ts`

Internal shared cache for `Intl.DateTimeFormat` instances. Mirrors
the invinite pattern (`ny-day-key.ts` caches one formatter; the
chartlang port caches *one per (tz, fields)* tuple).

```ts
const cache = new Map<string, Intl.DateTimeFormat>();

export function getFormatter(tz: string, fields: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(fields)}`;
  let f = cache.get(key);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...fields });
    cache.set(key, f);
  }
  return f;
}
```

### 4. `packages/core/src/time/nyDayKey.ts` — port

Source: `../invinite/src/components/trading-chart/indicators/lib/
ny-day-key.ts` @ `fb882a97e018ea0cc9a451fb7d839dc8d894c08b`.

Provenance header (matches the workspace 7-line shape from
`packages/runtime/src/ta/sma.ts`):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/ny-day-key.ts
//   (commit fb882a97e018ea0cc9a451fb7d839dc8d894c08b, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

Surface:

```ts
import type { Time } from "../types.js";
import { getFormatter } from "./_lib/dateTimeFormatCache.js";

const NY_DAY_FIELDS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

/**
 * "YYYY-MM-DD" key for the given Time in the America/New_York timezone.
 *
 * DST-safe (handles spring-forward / fall-back).
 *
 * @example
 *   nyDayKey(1709251200000 as Time); // "2024-03-01"
 *
 * @since 0.6
 * @stable
 */
export function nyDayKey(t: Time): string {
  const parts = getFormatter("America/New_York", NY_DAY_FIELDS).formatToParts(t);
  let year = "", month = "", day = "";
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    else if (p.type === "month") month = p.value;
    else if (p.type === "day") day = p.value;
  }
  return `${year}-${month}-${day}`;
}
```

### 5. `packages/core/src/time/sessionBoundaries.ts` — port

Source: `../invinite/src/components/trading-chart/indicators/lib/
session-boundaries.ts` @ `fb882a97e018ea0cc9a451fb7d839dc8d894c08b`.

Provenance header (matches the workspace 7-line shape from
`packages/runtime/src/ta/sma.ts`):

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/session-boundaries.ts
//   (commit fb882a97e018ea0cc9a451fb7d839dc8d894c08b, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

Surface — port the invinite helpers into the chartlang shape:

- `nySessionBounds(t: Time): SessionBounds` — regular NY session
  09:30–16:00 ET, returns Unix-ms bounds for the day containing `t`.
- `regularSession(tz: string, t: Time): SessionBounds | null` — calls
  `getFormatter(tz, {...})` to compute the calendar day, then derives
  09:30–16:00 in `tz`. Returns `null` for weekends.
- `extendedSession(tz: string, t: Time): SessionBounds | null` — same
  but 04:00–20:00 ET (or the `tz` equivalent for non-US sessions).
  Returns `null` for weekends.
- `isOpen(tz: string, t: Time, type: SessionType): boolean` — delegates
  to `regularSession` / `extendedSession`, returns `true` when
  `bounds !== null && startMs <= t < endMs`.

The original invinite file ships `SessionType = "daily" | "monthly" |
"weekly" | "yearly"` + range-finding helpers (`findRecentSessionRanges`,
`findPreviousSessionRange`). These are **out of scope** for Phase 6 —
the indicator-consumer surface lands later. Phase 6 ports only the
calendar / boundary functions.

### 6. `packages/core/src/time/weekday.ts` — net-new

Signature: `weekday(tz: string, t: Time): Weekday` (0 = Sunday … 6 =
Saturday). Implementation: `getFormatter(tz, { weekday: "short" })`
→ `formatToParts(t)` → map short name (`"Sun"`/`"Mon"`/…/`"Sat"`)
to index 0–6 via a frozen lookup array. Uses `/* c8 ignore */` on
the two unreachable error branches (`Intl` always emits a known
weekday part). Carries `@since 0.6`, `@stable`, `@example`.

### 7. `packages/core/src/time/weekKey.ts` — net-new

Signature: `weekKey(tz: string, t: Time): string` returning
`"GGGG-Www"` per ISO 8601. Implementation: `getFormatter(tz, {...})`
→ Y/M/D → standard ISO Jan-4 algorithm (week-numbering year may differ
from calendar year for the first / last days). Carries `@since 0.6`,
`@stable`, `@example`. The inline `weeklyKey` helper inside the
invinite `session-boundaries.ts` source is the reference algorithm.

### 8. `packages/core/src/time/session.ts` — frozen namespace

Exports `session = Object.freeze({ regular, extended, isOpen })`
delegating to `sessionBoundaries.ts`. The exported value carries a
`satisfies` clause pinning each method signature. `Object.isFrozen`
is asserted in tests. JSDoc: `@since 0.6`, `@stable`.

### 9. `packages/core/src/time/index.ts`

```ts
export type { SessionBounds, SessionType, Weekday } from "./types.js";
export { nyDayKey } from "./nyDayKey.js";
export { nySessionBounds } from "./sessionBoundaries.js";
export { session } from "./session.js";
export { weekday } from "./weekday.js";
export { weekKey } from "./weekKey.js";
```

### 10. `packages/core/package.json` exports

Append the subpath entry:

```json
"exports": {
  ".": { ... existing ... },
  "./time": {
    "types": "./dist/time/index.d.ts",
    "import": "./dist/time/index.js"
  }
}
```

### 11. `CORE_AMBIENT_SHIM` declarations

`packages/compiler/src/program.ts` already wraps the main barrel. The
`/time` subpath needs its own ambient declarations so compiled
scripts can `import` from it:

Append a fresh `declare module "@invinite-org/chartlang-core/time"`
block to the shim with the type aliases + function signatures listed
above.

### 12. Tests

- `packages/core/src/time/nyDayKey.test.ts` — unit cases covering
  DST transitions (spring-forward 2024-03-10, fall-back 2024-11-03),
  midnight ET boundaries, year-end / leap day.
- `packages/core/src/time/nyDayKey.golden.test.ts` — captured
  golden vs the invinite reference outputs for a curated set of
  timestamps spanning 2020–2025 (DST transitions, leap year, holidays).
- `packages/core/src/time/sessionBoundaries.test.ts` — unit cases:
  - Weekend → `null` for both regular and extended.
  - Pre-09:30 → `null` regular; non-null extended (if extended starts
    at 04:00).
  - 09:30:00 → bounds start exactly at this instant; `isOpen` true.
  - 16:00:00 (close) → `isOpen` false (half-open interval).
  - Cross-timezone bounds.
- `packages/core/src/time/sessionBoundaries.golden.test.ts` — pinned
  golden vs invinite reference for 30 timestamps including DST
  transitions in both directions.
- `packages/core/src/time/weekday.test.ts` — every day of the week
  in `UTC`, `America/New_York`, `Asia/Tokyo`.
- `packages/core/src/time/weekKey.test.ts` — ISO-week edge cases:
  Jan 1 falling on Thursday (year matches), Jan 1 on Friday (previous
  year), Dec 31 on Monday (next year), week 52 vs week 53.
- `packages/core/src/time/session.test.ts` — verifies the frozen
  namespace shape (`Object.isFrozen(session)`); delegation smoke test.
- `packages/core/src/time/_lib/dateTimeFormatCache.test.ts` —
  same key returns the same instance; different `tz` returns different
  instances; different `fields` returns different instances.

### 13. JSDoc + docs gates

Every export carries `@since 0.6`, `@stable`, and a compiling
`@example`. `pnpm docs:check` auto-generates
`docs/primitives/time/<name>.md` from the JSDoc; verify each helper
appears.

### 14. README + CLAUDE.md

`packages/core/README.md` adds **one** line to the subpath table
documenting `@invinite-org/chartlang-core/time`. ≤ 100 lines total.
`packages/core/src/time/CLAUDE.md` documents the port convention,
`tz` contract, formatter-cache invariants.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/time/CLAUDE.md` | Create | Port convention + invariants. |
| `packages/core/src/time/index.ts` | Create | Subpath barrel. |
| `packages/core/src/time/types.ts` | Create | `SessionBounds`, `SessionType`, `Weekday`. |
| `packages/core/src/time/nyDayKey.ts` | Create | Port from invinite. |
| `packages/core/src/time/sessionBoundaries.ts` | Create | Port from invinite. |
| `packages/core/src/time/weekday.ts` | Create | Net-new. |
| `packages/core/src/time/weekKey.ts` | Create | Net-new. |
| `packages/core/src/time/session.ts` | Create | Frozen `session` namespace. |
| `packages/core/src/time/_lib/dateTimeFormatCache.ts` | Create | Internal formatter cache. |
| `packages/core/src/time/*.test.ts` | Create | Unit + golden tests per surface. |
| `packages/core/package.json` | Modify | Add `"./time"` subpath export. |
| `packages/compiler/src/program.ts` | Modify | `declare module "@invinite-org/chartlang-core/time"` block. |
| `packages/core/README.md` | Modify | One-line subpath entry. |
| `scripts/gen-docs.ts` | Modify (if needed) | Wire `/time` subpath into the doc-generation list. |
| `.changeset/phase6-time-subpath.md` | Create | Minor bump on `@invinite-org/chartlang-core`. |

## Gates

- `pnpm typecheck` — strict; subpath types resolve through the new
  `exports` entry.
- `pnpm lint`.
- `pnpm test` — 100% coverage on `packages/core/src/time/`.
- `pnpm docs:check` — new `docs/primitives/time/*.md` pages exist.
- `pnpm readme:check` — `packages/core/README.md` ≤ 100 lines.

## Changeset

`.changeset/phase6-time-subpath.md`:

```md
---
"@invinite-org/chartlang-core": minor
---

Add `@invinite-org/chartlang-core/time` subpath with session,
calendar, and timezone helpers (`session.regular` / `extended` /
`isOpen`, `nyDayKey`, `nySessionBounds`, `weekday`, `weekKey`).
Ported from invinite. Pure functions over `Time` with an explicit
`tz` parameter — no implicit global timezone.
```

## Acceptance Criteria

- [ ] `packages/core/src/time/` exists with every file from the
      surface list.
- [ ] Provenance header (7-line workspace shape) present on
      `nyDayKey.ts` and `sessionBoundaries.ts` citing the invinite SHA
      `fb882a97e018ea0cc9a451fb7d839dc8d894c08b`.
- [ ] Every public symbol carries `@since 0.6`, `@stable`, and a
      compiling `@example`.
- [ ] Golden tests pin outputs against invinite reference for a
      DST-transition timestamp set (spring + fall, both 2024 and
      2025).
- [ ] `Object.isFrozen(session) === true`.
- [ ] `packages/core/package.json` exports `"./time"` with both
      `types` and `import` entries.
- [ ] `CORE_AMBIENT_SHIM` declares the `@invinite-org/chartlang-core/time`
      module so compiled scripts can import from it.
- [ ] 100% coverage on `packages/core/src/time/`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
      `pnpm readme:check` all green.
- [ ] Auto-generated `docs/primitives/time/*.md` pages exist for
      every helper.
- [ ] Changeset committed.
