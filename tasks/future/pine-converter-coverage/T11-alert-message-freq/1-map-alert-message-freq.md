# Task 1 — Map Pine `alert(message, freq)` → chartlang `alert(message, opts?)`

> **Status: TODO**

## Goal

Lower Pine's `alert(message, frequency)` builtin to chartlang's
`alert(message, opts?)` — consuming the `alert.freq_*` frequency argument so it
no longer leaks as an undefined symbol. **Converter-only**: the signature
verification below shows chartlang's `alert` is already message-first and is
called imperatively inside `compute`, so Pine's `if cond` / `alert(msg, freq)`
maps almost directly — no condition-hoisting and no core change in v1.

## Prerequisites

- **T9** (leading-operator line continuation) — MASM's alert trigger conditions
  are multi-line; without T9 they don't parse. T11 lowering is testable
  independently on single-line conditions.

## Current Behavior

**Signature verification (resolved — the README's earlier premise was wrong):**
- chartlang `alert` is **`alert(_message: string, _opts?: AlertOpts)`**
  (`packages/core/src/alert/alert.ts`) — a **message string** first arg, NOT a
  boolean condition. `AlertOpts = { severity?: AlertSeverity; meta?: Record<…> }`
  — there is **no `frequency` field**. `alert` is a stateful hole called
  imperatively inside `compute` (registered in `STATEFUL_PRIMITIVES`).
- So Pine's imperative `if cond` / `alert(msg, freq)` already matches
  chartlang's `if (cond) { alert(msg, opts?) }`. **No condition is hoisted into
  the alert call.**

**What breaks today:**
- `alert` is a recognized bare-stateful name
  (`src/transform/statefulNames.ts`, `BARE_STATEFUL_NAMES`), so the call and its
  enclosing `if` already emit. But the call's args go through generic
  `emitExpr`, so the Pine 2nd arg `alert.freq_all` is emitted **verbatim** as an
  undefined member access. Evidence (ran built converter):
  ```ts
  if (bar.close > bar.open) { alert('{"a":1}', alert.freq_all); }
  ```
  `alert.freq_all` is not a chartlang symbol → won't compile. No diagnostic.
- `src/transform/strategySignals.ts` already emits well-formed
  `alert(${JSON.stringify(message)}, { severity: "info" })` for the
  strategy-order path — the emission shape to mirror.

## Desired Behavior

```ts
// Pine:
//   if not na(alert_msg)
//       alert(alert_msg, alert.freq_all)
// chartlang (if preserved; frequency dropped with an info):
if (alertMsg !== null) {
    alert(alertMsg);            // message passes through; freq arg consumed
}
```

The message expression (incl. Pine string concat
`'{"symbol":"' + syminfo.ticker + '",...}'`) emits as an ordinary string
expression.

## Requirements

### 1. Recognize the direct `alert(message, freq?)` call

- In the `alert` lowering path (extend the bare-stateful handling in
  `src/transform/other.ts` / `statefulNames.ts`, or add a small dedicated
  `alertCall.ts` emitter mirroring `strategySignals.ts`), detect a call whose
  callee is the bare `alert` with 1–2 positional args.
- Arg 1 (message) → emit via the existing expression emitter
  (`emitWithContext`), preserving string concat.

### 2. Consume / map the frequency arg

- Recognize the Pine frequency enums `alert.freq_all`,
  `alert.freq_once_per_bar`, `alert.freq_once_per_bar_close` by adding them as
  rows to `ENUM_VALUE_MAP` in `src/mapping/enums.ts` (each → `null`, the REJECT
  marker, like `xloc.*`) so the symbol is consumed via the mapping table, never
  passed to `emitExpr`. Per the repo invariant, the mapping decision must route
  through `src/mapping/` — do **not** inline a private `ALERT_FREQ` set in the
  transform.
- **v1 disposition (recommended): DROP the frequency** and emit
  `alert(<message>)`, raising a new **info** diagnostic
  `alert-frequency-not-mapped` (chartlang `AlertOpts` has no `frequency`, so the
  value cannot be honored). Document the alternative (stash into
  `{ meta: { frequency: "all" } }`) and why drop is preferred for v1 (meta is a
  host payload, not an execution-frequency contract).

### 3. Preserve the enclosing `if`

- Do **not** hoist the `if` condition into the `alert(...)` call. The Pine
  `if cond { alert(...) }` lowers to chartlang `if (cond) { alert(...) }`
  verbatim — chartlang alert is imperative, same as Pine. Confirm the
  `varip`-gated dedup flag (`alerted_this_session := true`) lowers via the
  existing `varip` → `state.tick.*` path and does not block the alert.

### 4. Diagnostics

- Append `alert-frequency-not-mapped` (severity **info**) to
  `src/diagnostics/codes.ts` (`DIAGNOSTIC_CODE_ENTRIES`, append-only).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` (or new `alertCall.ts`) | Modify/Create | Lower direct `alert(message, freq?)`; drop frequency; mirror `strategySignals.ts` emission. |
| `packages/pine-converter/src/mapping/enums.ts` | Modify | Recognize `alert.freq_*` so the symbol is consumed. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `alert-frequency-not-mapped` (info). |
| `packages/pine-converter/src/transform/*.test.ts` | Modify | Unit coverage (drop freq, each enum, message concat, varip dedup). |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the alert(message,freq) lowering + frequency-drop. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by Task 2's `@invinite-org/chartlang-pine-converter` **patch**
changeset. **No core change in v1** (chartlang `alert` already accepts a
message; frequency is dropped). Adding `frequency` to `AlertOpts` + runtime/host
emission is a **deferred core follow-up**, not this task.

## Acceptance Criteria

- MASM's four `alert(...)` triggers lower to compiling chartlang `alert(message)`
  calls inside their `if` blocks; no bare `alert.freq_*` symbol survives.
- An `alert-frequency-not-mapped` info is raised once per dropped frequency.
- The enclosing `if` condition is preserved (not hoisted).
