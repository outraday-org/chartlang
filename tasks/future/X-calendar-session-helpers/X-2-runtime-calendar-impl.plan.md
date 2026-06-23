# Task 2 — Runtime UTC / fixed-offset calendar impl — PLAN

> Audit artifact. Every path/line below was verified against the working tree
> on 2026-06-23.

## Context

Implement the `time.*` accessors + `time.timeClose` at **runtime** with pure
integer epoch arithmetic (Howard Hinnant `civil_from_days`) — **no `Date`, no
`Intl`** — supporting UTC + fixed-offset zones only, so output is
byte-reproducible across hosts. Install a frozen `time` namespace on
`ComputeContext` (like `ta`), defaulting `tz` from `syminfo.timezone`. A
DST-bearing IANA zone resolves to UTC + a one-time `tz-dst-unsupported`
diagnostic (mirroring `session-info-missing`). `session.isOpen` is **Task 4** —
left as the core sentinel hole here.

## Pre-existing work (verified, do NOT touch)

- **Task 1 core surface (uncommitted, landed):**
  `packages/core/src/time-accessors/{timeAccessors,sessionAccessors,index}.ts`
  define the `time` / `session` sentinel-hole namespaces + `TimeNamespace` /
  `SessionNamespace`. Signatures confirmed: `time.year(t, tz?)` … `second`,
  `dayofweek` (Pine 1=Sun..7=Sat), `timestamp(y, mo, d, hh?, mm?, ss?, tz?)`,
  `timeClose(t, tz?)`; `session.isOpen(t, spec, tz?)`. `@since 1.5`.
- **Registry:** `packages/core/src/statefulPrimitives.ts:209-218` already lists
  all `time.*` + `session.isOpen` entries as `slot: false`.
- **Runtime re-export seam:** `packages/runtime/src/primitives.ts:35` currently
  re-exports `{ session, time }` from core (the sentinel holes).
  `buildComputeContext.ts:45-46` already installs `time` / `session` on the
  context by identity. **This task swaps the `time` export to the real runtime
  namespace; `session` stays the core hole until Task 4.**
- **Changeset** `.changeset/calendar-session-helpers.md` already includes
  runtime as `minor` — no new changeset, no edit needed.
- Other uncommitted work in the tree (state-array, multi-symbol-security,
  bgcolor, cal-task-1) is out of scope — diff stays calendar-task-2-only.

## Issues found / decisions

1. **`primitives.ts` re-export must split `time` (real) from `session` (hole).**
   Today line 35 re-exports both from core. After this task: `time` comes from
   `./time-accessors/index.js` (built via `buildComputeContext`), `session`
   stays the core hole. BUT `buildComputeContext` needs per-mount `ctx` to bind
   `getDefaultTz` / `onDstUnsupported`, so `time` can't be a module-level
   constant like `ta`. Decision: export a **builder** `buildTimeNamespace(ctx)`
   from `time-accessors/index.js`, call it in `buildComputeContext.ts`, and drop
   `time` from the `primitives.ts` import (keep `session` from core there). This
   matches `buildStateNamespace()` / `buildRequestNamespace()` already imported
   in `buildComputeContext.ts:10-11`.
2. **The accessors themselves must stay stateless** (README/task §3): the
   factory closes over `getDefaultTz` + `onDstUnsupported` bound at install
   time; the accessor bodies never read `ACTIVE_RUNTIME_CONTEXT`. This keeps
   them `slot: false`-honest and lets the property tests drive them directly.
3. **`tz-dst-unsupported` dedup keyed without a slot id.** `slot: false`
   primitives carry no slotId. Add a dedicated
   `RuntimeContext.diagnosedTzKeys: Set<string>` keyed `tz-dst-unsupported|<tz>`
   (mirrors `diagnosedRequestKeys`), cleared in `dispose`. Do NOT overload
   `diagnosedRequestKeys` (its key grammar is `code|slotId|interval|kind`).
4. **`timeClose` reads the live interval.** Signature is `timeClose(t, tz?)`
   with no interval arg. Bind a `getIntervalMs = () => views.timeframe.inSeconds
   * 1000` closure in the builder; `inSeconds` is **seconds**
   (`timeframeView.ts:46-55`), and is `NaN` for an unparseable interval → `t +
   NaN = NaN`, which is correct never-throw behaviour. `tz` is ignored for the
   math (close = start + interval, tz-invariant) but accepted for surface
   symmetry; a DST `tz` still fires the diagnostic for consistency.
5. **`DiagnosticCode` union lives in `adapter-kit`**
   (`packages/adapter-kit/src/types.ts:801-833`) — add `"tz-dst-unsupported"`
   there (one place). Conformance has no static code allowlist
   (`runConformanceSuite.ts` matches codes structurally), so no allowlist edit.
6. **Bench:** a tight local loop (not `benchHotLoop`, which needs a `bar.close`
   series) calling `time.year` 100k×, with the `.bench.ts` + `.bench.test.ts`
   pair per the runtime bench invariant. `THRESHOLD_MS` generous for CI Linux.

## Steps

1. **Create `packages/runtime/src/time-accessors/civil.ts`** — pure integer
   `floorDiv` / `mod` (toward −∞), `civilFromDays(z)`, `daysFromCivil(y,m,d)`,
   `splitEpoch(ms, offsetMin) → { y, m, d, hh, mm, ss, dow }` (dow 0=Sun..6=Sat
   via `mod(z + 4, 7)` — 1970-01-01 was Thursday; comment it). Provenance:
   Howard Hinnant public-domain algorithm note (algorithm only). MIT header +
   JSDoc on exports.
2. **Create `packages/runtime/src/time-accessors/tzOffset.ts`** —
   `resolveOffsetMinutes(tz) → { offsetMin, dstUnsupported }`. UTC aliases → 0;
   `±HH:MM` / `±HHMM` / `UTC±H` / `Etc/GMT±H` (POSIX inverted sign) → parsed
   integer minutes; any other (region name) → `{ 0, true }`. Pure, no `Intl`.
3. **Create `packages/runtime/src/time-accessors/timeAccessors.ts`** —
   `createTimeNamespace(getDefaultTz, getIntervalMs, onDstUnsupported):
   TimeNamespace` (frozen). Each numeric accessor: resolve tz → offset, flag
   DST once, guard non-finite `t` → `NaN`, `splitEpoch`, return field;
   `dayofweek` → `dow + 1`. `timestamp(...)`: validate fields finite/in-range →
   `NaN` else `daysFromCivil*86_400_000 + (hh*3600+mm*60+ss)*1000 −
   offsetMin*60_000`. `timeClose(t, tz?)`: flag DST, non-finite guard, `t +
   getIntervalMs()`. Plus `buildTimeNamespace(ctx: RuntimeContext)` binding the
   closures to `ctx.views.syminfo.timezone`, `ctx.views.timeframe.inSeconds`,
   and the §4 dedup. MIT header + full JSDoc (@example/@since 1.5/@stable).
4. **Create `packages/runtime/src/time-accessors/index.ts`** — barrel exporting
   `buildTimeNamespace` (+ types if any). Coverage-excluded.
5. **Modify `packages/runtime/src/runtimeContext.ts`** — add
   `readonly diagnosedTzKeys: Set<string>;` with JSDoc (@since 1.5).
6. **Modify `packages/runtime/src/createScriptRunner.ts:~368`** — initialise
   `diagnosedTzKeys: new Set(),` alongside `diagnosedRequestKeys`.
7. **Modify `packages/runtime/src/execution/dispose.ts:~75`** — clear
   `diagnosedTzKeys` alongside `diagnosedRequestKeys`.
8. **Modify `packages/runtime/src/primitives.ts`** — drop `time` from the core
   re-export (keep `session`); the runtime `time` now comes via
   `buildTimeNamespace`. Remove `time` from `buildComputeContext.ts`'s
   `primitives.js` import.
9. **Modify `packages/runtime/src/buildComputeContext.ts`** — import
   `buildTimeNamespace`; set `time: buildTimeNamespace(state.runtimeContext)` in
   `base` (replacing the imported `time`); keep `session` from primitives.
10. **Modify `packages/adapter-kit/src/types.ts`** — add `"tz-dst-unsupported"`
    to the `DiagnosticCode` union + a JSDoc sentence describing it.
11. **Tests** (co-located, 100% incl. branch + property):
    `civil.test.ts` + `civil.property.test.ts` (round-trip
    `daysFromCivil(civilFromDays(z)) === z` over fast-check int range incl.
    negatives), `tzOffset.test.ts`, `timeAccessors.test.ts` (UTC fixture
    `2024-01-02T13:45:30Z`, Pine dow, fixed-offset day-shift, DST→UTC + dedup
    fires once, NaN inputs, timestamp round-trip, timeClose = t+interval).
12. **Bench pair** `timeAccessors.bench.ts` + `.bench.test.ts`.
13. **Update `packages/runtime/CLAUDE.md`** — one invariant: UTC/fixed-offset
    determinism + `diagnosedTzKeys` + `tz-dst-unsupported` once-per-tz.

## Files table

| File | Action |
|---|---|
| `packages/runtime/src/time-accessors/civil.ts` | Create |
| `packages/runtime/src/time-accessors/civil.test.ts` | Create |
| `packages/runtime/src/time-accessors/civil.property.test.ts` | Create |
| `packages/runtime/src/time-accessors/tzOffset.ts` | Create |
| `packages/runtime/src/time-accessors/tzOffset.test.ts` | Create |
| `packages/runtime/src/time-accessors/timeAccessors.ts` | Create |
| `packages/runtime/src/time-accessors/timeAccessors.test.ts` | Create |
| `packages/runtime/src/time-accessors/timeAccessors.bench.ts` | Create |
| `packages/runtime/src/time-accessors/timeAccessors.bench.test.ts` | Create |
| `packages/runtime/src/time-accessors/index.ts` | Create |
| `packages/runtime/src/runtimeContext.ts` | Modify (`diagnosedTzKeys`) |
| `packages/runtime/src/createScriptRunner.ts` | Modify (init set) |
| `packages/runtime/src/execution/dispose.ts` | Modify (clear set) |
| `packages/runtime/src/primitives.ts` | Modify (drop `time` re-export) |
| `packages/runtime/src/buildComputeContext.ts` | Modify (install builder) |
| `packages/adapter-kit/src/types.ts` | Modify (`tz-dst-unsupported` code) |
| `packages/runtime/CLAUDE.md` | Modify (invariant) |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no THRESHOLD regression)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`
- (if core export missing) `pnpm -F @invinite-org/chartlang-core build` first

## Changeset

Already covered by `.changeset/calendar-session-helpers.md` (runtime minor) —
no change.

## Acceptance criteria

- `time.*` + `time.timeClose` return correct UTC/fixed-offset fields via pure
  integer math; **no `Date`/`Intl`** on the accessor path.
- tz defaults from `syminfo.timezone` (fallback UTC); DST zone → UTC +
  once-per-tz `tz-dst-unsupported`.
- `dayofweek` Pine 1..7; non-finite/out-of-range → `NaN`; never throws.
- Installed on `ComputeContext` identity-stable per mount (builder bound to the
  mount's `ctx`).
- Runtime coverage 100%; bench within threshold; typecheck/lint/docs:check green.
