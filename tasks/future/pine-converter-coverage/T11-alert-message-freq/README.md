# T11 — Converter: `alert(message, freq)` + `alert.freq_*`

## Overview

Map Pine's `alert(message, frequency)` builtin — a string payload fired from
inside an `if` block, with an `alert.freq_*` frequency enum — onto chartlang's
`alert(...)` surface. `MASM_Strat.md`'s API-alert engine is the reference:

```pine
if alert_trigger_go_long
    alert_msg := '{"symbol": "' + syminfo.ticker + '", "action": "buy", ...}'
...
if not na(alert_msg)
    alert(alert_msg, alert.freq_all)
    alerted_this_session := true
```

This is **not** a v5-ism (no `alert` change in the v5→v6 guide). **Signature
verified — it's converter-only:** chartlang `alert` is already message-first
and imperative, so the fix is small (drop the frequency arg).

## Current State (evidence — ran built converter)

**Signature (verified in `packages/core/src/alert/alert.ts`):** chartlang
`alert` is **`alert(message: string, opts?: AlertOpts)`** — a **message string**
first arg (NOT a boolean condition), with `AlertOpts = { severity?; meta? }`
and **no `frequency`** field. It is a stateful hole called imperatively inside
`compute`. So Pine's `if cond` / `alert(msg, freq)` already matches chartlang's
`if (cond) { alert(msg, opts?) }`. *(The earlier README claim of
`alert(condition, opts)` was incorrect.)*

Pine `if close > open` then `alert('{"a":1}', alert.freq_all)` → **no
diagnostic**, but:

```ts
if (bar.close > bar.open) { alert('{"a":1}', alert.freq_all); }
```

`alert` is already a recognized bare-stateful name
(`src/transform/statefulNames.ts`) so the call + `if` emit fine — the **only**
breakage is the 2nd arg `alert.freq_all`, emitted verbatim via `emitExpr` as an
undefined member access → won't compile.

## Target State

- Pine `alert(message, freq)` inside `if <cond>` lowers to chartlang
  `alert(<message>)` inside `if (<cond>)` — the message passes through, the
  enclosing `if` is **preserved** (no hoisting), and the `alert.freq_*` arg is
  **consumed**.
- **v1 disposition: drop the frequency** with an `alert-frequency-not-mapped`
  (info) — chartlang `AlertOpts` has no `frequency` to honor. (`alert.freq_all`
  / `freq_once_per_bar` / `freq_once_per_bar_close` recognized via `src/mapping/`.)
- Adding `frequency` to core `AlertOpts` (+ runtime/host) is a **deferred core
  follow-up**, not part of v1.

## Architecture Decisions (resolved in step 2)

| Decision | Notes |
|----------|-------|
| **Signature — RESOLVED: converter-only** | Verified `alert(message, opts?)` in `packages/core/src/alert/alert.ts`; `AlertOpts = { severity?, meta? }`, no `frequency`. chartlang alert is message-first + imperative → Pine `if cond` / `alert(msg, freq)` maps directly. No core change in v1. |
| `if`-fired alert stays an `if` | Do **not** hoist the condition. chartlang alert is imperative-in-`compute`, same as Pine: `if (cond) { alert(msg) }`. MASM's `if not na(alert_msg)` lowers to `if (alertMsg !== null) { … }` unchanged. |
| Frequency disposition — **drop in v1** | `AlertOpts` has no `frequency`, so the value can't be honored. Drop the `alert.freq_*` arg + emit `alert-frequency-not-mapped` (info). Alternative (stash in `{ meta: { frequency } }`) documented but not chosen. Adding `frequency` to core `AlertOpts` is a deferred follow-up. |
| Frequency enum recognition | Recognize `alert.freq_all` / `freq_once_per_bar` / `freq_once_per_bar_close` via `src/mapping/enums.ts` so the symbol is consumed, never leaked to `emitExpr`. |
| Reuse `strategySignals.ts` | `src/transform/strategySignals.ts` already emits `alert(JSON.stringify(msg), { severity: "info" })` — mirror its emission shape. |
| `alertcondition()` vs `alert()` | Scope to `alert()`; note `alertcondition` separately (deferred). |
| `varip` alert-dedup state | MASM's `alerted_this_session` (`varip bool`) lowers via the existing `varip` → `state.tick.*` path; ensure it doesn't block the alert lowering. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| chartlang `alert` surface | `packages/core/src/plot/plot.ts` (`alert`) | Target signature; verify opts. |
| Alert / plot-family lowering | `src/transform/plotFamily.ts` / `other.ts` | Where `alert(...)` is recognized + lowered. |
| Enum mapping | `src/mapping/` (`ENUM_VALUE_MAP`) | `alert.freq_*` → frequency. |
| `varip` → tick state | `src/transform/other.ts` (scalar state slots) | Dedup flag (`alerted_this_session`). |

## Dependencies

- **T9** (leading-op continuation) — MASM's alert conditions are multi-line.
- No core dependency in v1 (signature verified message-first).

## Dependency Graph

```
Task 1 (map alert(message, freq) -> alert(message); drop freq + info; enum recognition)
  |
  v
Task 2 (fixtures + compile round-trip + docs/CLAUDE)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Map `alert(message, freq)` → `alert(message, opts?)`](./1-map-alert-message-freq.md) | pine-converter | T9 | Medium |
| 2 | [Fixtures, compile round-trip, docs](./2-fixtures-docs.md) | pine-converter, docs | 1 | Low |

## Acceptance Criteria

- MASM's four `alert(...)` triggers convert to compiling chartlang
  `alert(message)` calls inside their `if` blocks.
- No bare `alert.freq_*` symbol survives; one `alert-frequency-not-mapped` info
  per dropped frequency.

## Deferred / Follow-Up

- `alertcondition()`.
- Dynamic per-tick alert message recomputation nuances beyond MASM's pattern.
