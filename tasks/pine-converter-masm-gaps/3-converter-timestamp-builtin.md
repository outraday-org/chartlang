# `timestamp()` Builtin Mapping

> **Status: TODO**

## Goal

Map Pine's `timestamp(year, month, day, hour?, minute?, second?, tz?)`
builtin to chartlang's existing `time.timestamp(...)`. This is the
single most impactful "unknown-identifier" fix for date-window strategy
logic — MASM's entire timeframe gating (`time >= timestamp(startYear,
startMonth, startDay, 0, 0)`) cascades from this one missing mapping.

## Prerequisites

None. (`time.timestamp` already exists in core — verified at
`packages/core/src/time-accessors/timeAccessors.ts:134`.)

## Current Behavior

`timestamp(...)` is absent from both builtin maps in
`packages/pine-converter/src/mapping/`, so the converter emits
`unknown-identifier` for every `timestamp(...)` call. In MASM this
produces 6 cascading errors at lines 227, 231, 237, 238 (the
`time >= timestamp(...)` comparisons).

`time` (bare and no-arg call) IS already mapped:

```ts
// builtinCalls.ts (~line 40)
["time", (args) => (args.length === 0 ? "bar.time" : null)],
["time_close", (args) => (args.length === 0 ? "time.timeClose(bar.time)" : null)],
```

The chartlang target already exists:

```ts
// core/src/time-accessors/timeAccessors.ts (~line 134)
timestamp(year, month, day, hour?, minute?, second?, tz?): Time { ... }
```

## Desired Behavior

`timestamp(2019, 1, 1, 0, 0)` → `time.timestamp(2019, 1, 1, 0, 0)`,
with all Pine arg arities (3 to 7 args) passed through verbatim. The
timezone (7th) arg, when present as a string literal, passes through
unchanged.

## Requirements

### 1. Add the call mapping

Append to `BUILTIN_CALL_MAP` in `src/mapping/builtinCalls.ts`:

```ts
["timestamp", (args) =>
    args.length >= 3 && args.length <= 7
        ? `time.timestamp(${args.join(", ")})`
        : null],
```

Arity outside 3–7 returns `null` (falls through to `unknown-identifier`,
matching the existing pattern for unsupported arities).

### 2. Verify the core signature cross-check

The mapping tables verify targets against `@invinite-org/chartlang-core`
(devDependency-only cross-check in `*.test.ts`). Add/extend the
`builtinCalls.test.ts` assertion that `time.timestamp` exists on the
core `TimeNamespace` type and accepts the emitted arity, mirroring the
existing `time_close` cross-check test.

### 3. Pine `timestamp("tz", y, m, d, …)` overload (scope note)

Pine also supports a leading-timezone overload
`timestamp(timezone, year, month, …)`. chartlang's `time.timestamp`
puts tz **last**. If the first arg is a string literal, this task may
either (a) reject with `null` (conservative — out of scope), or (b)
reorder to trailing tz. **Choose (a)** to keep the task small; note the
overload as deferred in CLAUDE.md. MASM uses only the numeric-first
form.

### 4. Golden fixture

Add the next-numbered fixture trio. Minimal `.pine` exercising the
MASM idiom:

```pine
//@version=6
indicator("timestamp gate")
in_window = time >= timestamp(2019, 1, 1, 0, 0) and time < timestamp(2027, 1, 1, 0, 0)
plot(in_window ? close : na)
```

Regenerate with `UPDATE_FIXTURES=1`; confirm `time.timestamp(2019, 1,
1, 0, 0)` in the output and zero `unknown-identifier` diagnostics. This
fixture should compile (`fixtures-compile.test.ts`).

### 5. Unit test

Extend `builtinCalls.test.ts`: assert
`BUILTIN_CALL_MAP.get("timestamp")?.(["2019","1","1","0","0"])` returns
`"time.timestamp(2019, 1, 1, 0, 0)"`, and that arity 2 / arity 8 return
`null`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/mapping/builtinCalls.ts` | Modify | Add `timestamp` row |
| `src/mapping/builtinCalls.test.ts` | Modify | Mapping + core cross-check |
| `fixtures/NN-timestamp-gate.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (compiles) |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/pine-converter/CLAUDE.md` | Modify | Note `timestamp` mapping + deferred tz-first overload |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage)

## Changeset

`.changeset/converter-timestamp-builtin.md` — `@invinite-org/chartlang-pine-converter: minor` (new builtin coverage).

## Acceptance Criteria

- `timestamp(...)` (arity 3–7, numeric-first) maps to `time.timestamp(...)`.
- Out-of-range arity and tz-first overload return `null` (deferred).
- Golden fixture added + compiles; count assertion bumped.
- 100% coverage; mapping cross-check test green.
- `CLAUDE.md` updated; changeset committed.
