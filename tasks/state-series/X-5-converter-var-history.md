# Task 5 — Pine converter: history-indexed `var` → `state.series`

> **Status: TODO**

## Goal

Lower a history-indexed numeric Pine `var`/`varip` scalar to `state.series`
instead of `state.float`/`int`, and emit its `[n]` history as a working
`s[n]` series index (not the non-compiling `<slot>.value[n]`). This converts
Pine's pervasive `var x := …; x[1]` idiom into compiling chartlang. Add a
fixture proving it, update the KNOWN-GAPS skip list, and keep the converter's
100% coverage gate green.

## Prerequisites

Tasks 1–3 (`state.series` exists end-to-end: type, compiler sizing, runtime).

## Current Behavior

- `transformOther` (`packages/pine-converter/src/transform/other.ts`) lowers
  scalar `var`/`varip` to `state.*` slots: `registerStateSlots` registers every
  scalar var; `emitStateSlots` picks the factory via `stateFactory` /
  `factoryForLiteralKind` (int→`state.int`, float→`state.float`, …; `varip` →
  `state.tick.*`). Reads rewrite to `<slot>.value`, `:=` to `<slot>.value = …`
  (`emitContext.ts:rewriteIdentifier`).
- History access emits verbatim `${operand(receiver)}[${offset}]`
  (`exprEmit.ts`, `case "history-access-expression"`). For a `var` scalar the
  receiver rewrites to `<slot>.value`, so `x[1]` → `<slot>.value[1]` — a
  **typecheck error** in chartlang (`.value` is scalar).
- `history-on-non-series` (`semantic/analyze.ts`) fires only when the
  receiver's inferred qualifier is **not** `series` (`inferQualifier(receiver)
  !== "series"`). A numeric `var` reassigned each bar infers as `series`, so
  its `x[n]` sails through with **no** diagnostic to the broken
  `<slot>.value[n]` emit.
- `dynamic-series-index` (`diagnostics/codes.ts`, error) is registered but
  **not wired**.
- `packages/pine-converter/CLAUDE.md` KNOWN GAPS: numeric `var` history and
  tuple-element history are unsupported; `close[i]` (OHLCV) now compiles.

## Desired Behavior

- A numeric `var`/`varip` scalar that is **history-indexed anywhere** (`x[n]`
  for any `n`) lowers to `const x = state.series(<init>)`; `x := expr` →
  `x.value = expr`; a value read `x` → `x.value` (coerces fine); a history
  read `x[n]` → `x[n]` (the bare series slot).
- A numeric `var` never history-indexed keeps its leaner scalar
  `state.float`/`int` lowering (unchanged).
- A non-numeric (`bool`/`string`) history-indexed `var` keeps its current
  lowering and gets a clear "series history non-numeric, unsupported in v1"
  diagnostic (no silent broken output).
- The new fixture round-trips: convert → compile (the
  `fixtures-compile.test.ts` round-trip) is clean.

## Requirements

### 1. Detect history-indexed scalars (`other.ts`)

After `registerStateSlots` builds the scalar-slot map, pre-scan the script body
for `history-access-expression` nodes whose receiver is an identifier resolving
to a registered scalar slot name (descend `if`/`for`/`switch`/block bodies +
expression trees — reuse the existing walk helpers). Collect a
`historyIndexedScalars: Set<string>` (Pine names). Partition by the slot's
inferred literal type:

- **numeric** (`int`/`float`, incl. `na`-init treated as numeric) → lower to
  `state.series`.
- **`bool`/`string`** → keep the existing factory and push the new
  `series-history-non-numeric` info (see §4); the generated `x.value[n]` stays
  a known gap (add to `KNOWN_NON_COMPILING` if it would otherwise fail the
  round-trip).

### 2. Emit `state.series` for those slots (`other.ts` `emitStateSlots`)

For a numeric scalar in `historyIndexedScalars`, choose the factory
`state.series` and the init expression `state.series(<init>)`:

- literal numeric init → that literal (`var float x = 1.5` → `state.series(1.5)`).
- `na` init → `state.series(Number.NaN)`.
- un-inferable init (identifier/expression) → `state.series(Number.NaN)` +
  the existing `scalar-state-type-defaulted` info (same precedent as the
  `state.float` default).

A `varip` history-indexed numeric scalar lowers to `state.series` (non-tick) +
a `varip-series-approximated` info (state.tick.series is deferred — see
README Follow-Up). Reads/writes are unchanged (`x.value` / `x.value = …`).

### 3. Emit bare-slot history (`emitContext.ts` + `exprEmit.ts`)

Thread the series-slot set into `EmitContext` (e.g. `seriesSlots: ReadonlySet
<string>`). In the `history-access-expression` emit path, when the receiver is
an identifier in `seriesSlots`, emit the **bare** slot name + index
(`${slotName}[${offset}]`), NOT the `.value`-rewritten form. Value-context
reads of the same identifier continue through `rewriteIdentifier` →
`<slot>.value` (works — `state.series` is number-coercible and exposes
`.value`). Writes (`:=`) stay `<slot>.value = …`.

### 4. Wire `dynamic-series-index` + add the non-numeric code

- **Non-literal offset on a series slot:** when the history offset of a
  converter-lowered series slot is not a literal (nor a unary-literal), push
  the existing registered `dynamic-series-index` (currently an **error**) at
  the access span and still emit `s[<offset>]` so the generated source remains
  inspectable. Do **not** change the registered code's severity or default
  message (diagnostic codes are the stable public contract); the compile
  round-trip gate skips fixtures with error diagnostics.
- **`series-history-non-numeric`:** APPEND one new info code to
  `diagnostics/codes.ts` (no reorder), namespaced `pine-converter/transform/
  series-history-non-numeric`, message ~"History indexing on a non-numeric
  `var` is not supported in chartlang v1 (only numeric series)." Re-export
  nothing extra (codes are internal). `varip-series-approximated` may reuse an
  existing varip-approximation code if one fits, else APPEND it likewise
  (info).
- Update `code-coverage-grep.test.ts` expectations automatically (it walks
  `makeDiagnostic`/`pushCode` literals — just ensure every new key is
  registered).

### 5. Fixture (`packages/pine-converter/fixtures/`)

Add `30-var-series-history.pine` (next number in sequence) exercising the
idiom, e.g.:

```pine
//@version=6
indicator("Var series history", overlay=true)
var float prev = na
delta = close - prev
prev := close
plot(delta)
plot(prev[1])
```

Add `30-var-series-history.expected.chart.ts` (the converted output — `prev`
becomes `const prev = state.series(Number.NaN); … prev.value = bar.close...;
… plot(prev[1])`) and `30-var-series-history.expected.diagnostics.json`
(the emitted diagnostics, e.g. `scalar-state-type-defaulted` if any). The
golden corpus + `fixtures-compile.test.ts` round-trip guard it compiles.

### 6. Update KNOWN GAPS

- `KNOWN_NON_COMPILING` lives in
  `packages/pine-converter/src/tests/fixtures-compile.test.ts` (NOT
  `src/transform/`). It currently lists only `14-polyline-rebuild.pine` and
  `20-real-world-sr.pine` — there is **no** numeric-`var`-history entry to
  remove. The new `30-var-series-history.pine` fixture must **round-trip and
  compile**, so do **not** add it to the skip list. Leave tuple-element
  history (`macdLine[1]`) and bool/string series history as documented gaps.
- Update `packages/pine-converter/CLAUDE.md` KNOWN GAPS prose accordingly (per
  the repo rule: behavior change in a folder updates that folder's CLAUDE.md).

### 7. Tests

- `other.*.test.ts`: a numeric `var`/`varip` that is history-indexed emits
  `state.series(...)` + bare `name[n]` history; a numeric `var` NOT indexed
  still emits `state.float`/`int`; a `bool`/`string` history-indexed var emits
  `series-history-non-numeric`.
- `exprEmit` / `emitContext` tests: history receiver in `seriesSlots` emits the
  bare name; value read emits `.value`; non-literal offset emits
  `dynamic-series-index`.
- Defensive arms unreachable from real parser output covered by synthetic-AST
  tests (the established `*.synthetic.test.ts` precedent).

## Edge cases

- A `var` history-indexed in one branch but written in another: detection is
  whole-body, so it lowers to `state.series` regardless of where the `[n]`
  appears.
- `x[0]` (current) on a series slot emits `x[0]` — equivalent to `x.value`;
  both compile. No special-casing needed.
- Inline-expression history (`(a + b)[1]`) and tuple-element history remain
  out of scope (README Follow-Up) — do not attempt the general hoist here.
- Do not lower a `var` that holds a drawing handle / array / input — those are
  filtered out by `registerStateSlots` already.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` | Modify | Detect history-indexed numeric scalars; emit `state.series`. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify | `seriesSlots` set; bare-name history. |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | History-access bare-slot emit. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `series-history-non-numeric` (+ varip code if no existing one fits); leave `dynamic-series-index` severity unchanged. |
| `packages/pine-converter/fixtures/30-var-series-history.*` | Create | Fixture + expected output + diagnostics. |
| `packages/pine-converter/src/transform/*.test.ts` | Modify | Coverage for the new lowering. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep `30-var-series-history.pine` OUT of `KNOWN_NON_COMPILING` (it must compile). |
| `packages/pine-converter/CLAUDE.md` | Modify | KNOWN GAPS prose. |

## Gates

- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (pine-converter included as minor).

## Acceptance Criteria

- A numeric history-indexed `var`/`varip` lowers to `state.series` with bare
  `name[n]` history; the new fixture converts + compiles cleanly.
- A non-indexed numeric `var` keeps its scalar `state.float`/`int` lowering;
  bool/string history emits `series-history-non-numeric`.
- `dynamic-series-index` is wired for non-literal series-slot offsets (severity
  unchanged); new codes registered.
- KNOWN_NON_COMPILING + CLAUDE.md updated; converter tests green at 100%.
</content>
