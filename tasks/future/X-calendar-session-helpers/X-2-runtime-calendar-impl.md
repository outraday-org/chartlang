# Task 2 — Runtime UTC / fixed-offset calendar implementation

> **Status: TODO**

## Goal

Implement the `time.*` accessors at runtime with **pure integer epoch
arithmetic** (Howard Hinnant `civil_from_days`), supporting UTC and explicit
fixed offsets only — **no `Date`, no `Intl` on the author path** — so output is
byte-reproducible across hosts. Install the frozen `time` namespace on
`ComputeContext` (like `ta`), default the optional `tz` from
`syminfo.timezone`, and reject a real DST zone to UTC + a one-time diagnostic.
Keep the runtime 100% coverage + property + bench gates green.

## Prerequisites

Task 1 (`TimeNamespace` type + `time` holes + `slot: false` registry +
`ComputeContext.time` shim).

## Current Behavior

- The runtime installs the `ta` namespace on `ComputeContext` by identity from
  `packages/runtime/src/primitives.ts:27`; `buildComputeContext.ts:34` puts it
  on the context. There is no `time` / `session` install.
- `syminfo.timezone` is available at runtime —
  `createScriptRunner.ts:286` builds the view via `makeSymInfoView`;
  `buildComputeContext.ts:41` exposes it as `ctx.syminfo`.
- The host-only `packages/core/src/time/` folder (weekday/sessionBoundaries)
  uses `Intl` and is **not** reachable from a script — do not import it here.
- `ta.nz` is the stateless precedent: a plain function, no slot, no
  `ACTIVE_RUNTIME_CONTEXT` consult (`packages/runtime/src/ta/nz.ts`).

## Desired Behavior

- `time.year(t)` … `time.second(t)` and `time.dayofweek(t)` return the correct
  calendar field for `t` (UTC ms epoch) interpreted in the resolved zone;
  `time.timestamp(y, mo, d, hh?, mm?, ss?, tz?)` returns the UTC ms epoch for
  the given civil date/time in the resolved zone.
- `tz` resolution: explicit arg wins; else `syminfo.timezone`; else `"UTC"`.
- A `tz` of `"UTC"` / `"Etc/UTC"` / `"Z"` / `"GMT"`, or an explicit fixed
  offset (`"+HH:MM"` / `"-HH:MM"` / `"UTC+5"` / `"Etc/GMT-5"`-style), is applied
  as an integer minute offset. **Any other (DST-bearing) zone resolves to UTC
  and raises a one-time `tz-dst-unsupported` diagnostic** (next task pattern;
  see §4) — never an `Intl` lookup.
- Non-finite `t` (or `NaN`) yields `NaN` for every numeric accessor; an
  out-of-range `timestamp` field yields `NaN`.
- `dayofweek` returns `1=Sun .. 7=Sat` (Pine).

## Requirements

### 1. Civil-date core (`packages/runtime/src/time-accessors/civil.ts`, new)

Implement the pure integer routines (Howard Hinnant, public-domain reference;
add a provenance comment — algorithm only, not transcription):

```ts
// days since 1970-01-01 -> { y, m (1..12), d (1..31) }
function civilFromDays(z: number): { y: number; m: number; d: number };
// { y, m, d } -> days since 1970-01-01
function daysFromCivil(y: number, m: number, d: number): number;
```

Plus helpers `floorDiv` / `mod` (toward −∞, so pre-1970 epochs are correct) and
a `splitEpoch(ms, offsetMin)` that returns
`{ y, m, d, hh, mm, ss, dow }` where `dow` is `0=Sun..6=Sat` (derive from the
day count: `mod(z + 4, 7)` — 1970-01-01 was a Thursday, so the Sunday-anchored
formula is `((z % 7) + 11) % 7`; pick whichever the test fixture pins and
comment it). Everything is integer arithmetic on `Math.floor`'d ms — no `Date`.

Unit-test `civil.ts` directly against known epochs (e.g. `0 →
1970-01-01 Thu`, a leap-day `2024-02-29`, a pre-epoch `1969-12-31`, a negative
offset wrapping the date backwards). 100% branch coverage.

### 2. Offset resolution (`packages/runtime/src/time-accessors/tzOffset.ts`, new)

`resolveOffsetMinutes(tz: string): { offsetMin: number; dstUnsupported: boolean }`:

- `""` / `"UTC"` / `"Etc/UTC"` / `"GMT"` / `"Z"` → `{ 0, false }`.
- `"+HH:MM"` / `"-HH:MM"` / `"+HHMM"` / `"UTC±H"` / `"Etc/GMT±H"` (POSIX sign is
  inverted for `Etc/GMT`) → the parsed integer minutes, `false`.
- Any IANA region name (`"America/New_York"`, …) → `{ 0, true }` (DST
  unsupported in v1). Do NOT call `Intl`.

Pure + fully unit-tested (every branch). This is the **single** place the
UTC-first determinism policy lives.

### 3. Accessor implementations (`packages/runtime/src/time-accessors/timeAccessors.ts`, new)

A factory `createTimeNamespace(getDefaultTz: () => string, onDstUnsupported:
(tz: string) => void): TimeNamespace`:

- Each accessor resolves `tz ?? getDefaultTz()`, runs `resolveOffsetMinutes`,
  calls `onDstUnsupported(tz)` once-flagging when `dstUnsupported`, then
  `splitEpoch(t, offsetMin)` and returns the field. `dayofweek` maps
  `dow (0..6)` → `dow + 1` (`1..7`).
- Non-finite `t` → `NaN` (guard before `splitEpoch`).
- `timestamp(...)` → `daysFromCivil(y, mo, d) * 86_400_000 + (hh*3600 + mm*60 +
  ss) * 1000 − offsetMin*60_000`; non-finite/out-of-range field → `NaN`.

The namespace is `Object.freeze({...})`. It is **stateless** — no
`ACTIVE_RUNTIME_CONTEXT` consult inside the accessors themselves; the only
context they need (`getDefaultTz`, `onDstUnsupported`) is bound at install time
in §5.

### 4. `tz-dst-unsupported` diagnostic

Add a once-per-`(slot-less)` dedup: because these primitives carry no slotId,
key the dedup on `tz-dst-unsupported|<tz>` in a `RuntimeContext` set (mirror
`diagnosedRequestKeys` / the `session-info-missing` dedup in
`sessionVolumeProfile.ts:111-119`). `onDstUnsupported` pushes a warning
diagnostic (`code: "tz-dst-unsupported"`, message: "Timezone `<tz>` needs DST
data unavailable in this build; calendar fields used UTC.") at most once per
distinct tz per mount; clear the set on `dispose`.

> Register the new diagnostic code wherever runtime diagnostic codes are
> enumerated (grep for `"session-info-missing"` to find the union/registry and
> add `"tz-dst-unsupported"` alongside it, plus any conformance diagnostic-code
> allowlist).

### 5. Install on `ComputeContext` (`buildComputeContext.ts` + `primitives.ts`)

- Export a `buildTimeNamespace(ctx: RuntimeContext): TimeNamespace` (and the
  Task-4 `session`) builder, mirroring how `buildStateNamespace()` /
  `buildRequestNamespace()` are imported in `buildComputeContext.ts:11-12`.
  Bind `getDefaultTz = () => ctx.views.syminfo.timezone` and `onDstUnsupported`
  to the §4 dedup against `ctx`.
- Add `time: buildTimeNamespace(state.runtimeContext)` to the `base` object in
  `buildComputeContext.ts` (after `timeframe`, `:42`). (`session` lands in
  Task 4 — leave a placeholder note; do not break the build by referencing it
  before Task 4.)

> Because `time.*` resolves `tz` from `ctx.views.syminfo` which is the *live*
> per-mount view, and the namespace closes over `getDefaultTz` as a closure
> (not a snapshot), a `const { time } = ctx` keeps resolving against fresh
> syminfo — but syminfo timezone is mount-stable, so identity-stable install is
> fine. Match the `ta` install discipline (frozen, identity-stable per mount).

### 6. Tests (co-located; keep 100% coverage)

- `civil.test.ts`: known-epoch round-trips + leap/pre-epoch edges (every
  branch of `civilFromDays`/`daysFromCivil`/`splitEpoch`).
- `tzOffset.test.ts`: every offset-string form + every IANA-region →
  `dstUnsupported` branch.
- `timeAccessors.test.ts`: each accessor over a fixed UTC fixture (e.g.
  `2024-01-02T13:45:30Z`) returns the right field; `dayofweek` returns Pine
  `1..7`; a fixed-offset tz shifts the date; a DST zone falls back to UTC and
  fires `onDstUnsupported` exactly once; `NaN`/non-finite inputs → `NaN`;
  `timestamp` round-trips against an accessor read.
- Diagnostic dedup test: two `time.year(t, "America/New_York")` calls produce
  exactly one `tz-dst-unsupported` diagnostic.
- `bench` (`packages/runtime/src/time-accessors/*.bench.ts` + `.bench.test.ts`
  pair, per runtime CONTRIBUTING): `time.year` is on the script hot path;
  assert a `THRESHOLD_MS`. The integer math should be far under any TA bench;
  if it regresses, inline `splitEpoch` and document.

## Edge cases

- Pre-1970 epochs: `floorDiv`/`mod` must round toward −∞ so the date is
  correct (a naive `%` is wrong for negatives) — explicitly tested.
- A fixed offset that pushes `t` across a day boundary changes `dayofmonth` /
  `dayofweek` — tested.
- `time.*` allocates no slot and consults no per-callsite state, so it is safe
  to call any number of times per bar (no buffer growth) — unlike `ta.*`.
- These functions never throw (Pine-parity / `bar.point` "never throws"
  discipline): bad input → `NaN`, bad tz → UTC + diagnostic.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/time-accessors/civil.ts` | Create | `civilFromDays` / `daysFromCivil` / `splitEpoch`. |
| `packages/runtime/src/time-accessors/tzOffset.ts` | Create | `resolveOffsetMinutes` (UTC + fixed-offset only). |
| `packages/runtime/src/time-accessors/timeAccessors.ts` | Create | `createTimeNamespace` + `buildTimeNamespace`. |
| `packages/runtime/src/time-accessors/*.test.ts` | Create | Civil / offset / accessor / dedup tests. |
| `packages/runtime/src/time-accessors/*.bench.ts` + `.bench.test.ts` | Create | Hot-path bench + threshold. |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Install `time` on `ComputeContext`. |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add the `tz-dst-unsupported` dedup set. |
| (diagnostic-code registry/union) | Modify | Register `"tz-dst-unsupported"`. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS` regression
  or inline + document)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime included as minor).

## Acceptance Criteria

- `time.*` returns correct UTC/fixed-offset calendar fields via pure integer
  math; **no `Date`/`Intl`** imported on the accessor path.
- `tz` defaults from `syminfo.timezone` (fallback `"UTC"`); a DST zone falls
  back to UTC + a once-per-tz `tz-dst-unsupported` diagnostic.
- `dayofweek` is Pine `1..7`; non-finite inputs → `NaN`; accessors never throw.
- Installed on `ComputeContext` identity-stable per mount (like `ta`).
- Runtime coverage 100%; benches within threshold; typecheck/lint/docs:check
  green.
