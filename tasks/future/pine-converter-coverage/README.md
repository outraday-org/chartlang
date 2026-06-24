# Pine Converter — Real-World Conversion Coverage

## Overview

This is a **batch of task groups (T1–T12)** that together let the
`@invinite-org/chartlang-pine-converter` cleanly convert real-world
*calculation / strategy / multi-timeframe* Pine scripts. Two reference scripts
scope the work:

- **`Trend_Wizard.md`** (repo root, Pine **v6**, © TradeRational) — a
  calculation + MTF + dashboard-table indicator built out of user-defined
  helper functions and nested `ta.*` arithmetic. Surfaced **T1–T8**.
- **`MASM_Strat.md`** (repo root, Pine **v5**) — a strategy-turned-indicator
  with a position state machine, comparison mode, and an API-alert engine.
  Surfaced **T9–T12** plus extensions to T4 (and the deferred items below).

The converter today is **drawings-v1**: fully wired for the *drawing* surface
(`line/box/label/table/polyline/linefill`, `bar.point` anchoring,
`request.security` expression form, z-order). Both reference scripts are the
opposite shape and land on whole categories the converter rejects or — worse —
emits silently-broken output for.

Each TX has its own subfolder + README plus numbered task files
(`1-*.md`, `2-*.md`, …) following the house template. All groups (T1–T12)
are fully written and have been validated.

## Prerequisite: migrate v5 scripts to v6 first

The converter is intentionally **v6-only** (`//@version=5` →
`unsupported-pine-version` hard reject). `MASM_Strat.md` is v5, so it must be
**migrated to v6 before conversion** — this is mechanical (TradingView
auto-migrates on paste). Per the
[v5→v6 migration guide](https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/),
the only MASM-relevant migration effects are: the version directive itself;
bool `[]` history returns `false` (not `na`) on the first bar (which *helps* —
see T12); dynamic `request.*` is enabled by default; and `color.red`-style hex
constants changed (the converter's `ENUM_VALUE_MAP` should carry **v6** hex).
**Adding v5 support to the converter is NOT a task** — migrate the source.

## What already works (no task needed)

- Inline inputs mid-expression (`ta.wma(x, input.float(1.1))`) →
  `inline-input-promoted` ✓
- Top-level `x = ta.foo(scalarExpr, len)` → `.current` scalar lowering ✓
- Plain `plot`/`hline`, color **enums**, `var` scalars → `state.*`, series
  history `x[1]`, single-value `switch`, `if`, ternary, `math.*` (native
  `Math.*`), `barstate.islast/isrealtime`, `syminfo.tickerid`, `line.new` /
  `label.new` / `plotshape`.

## Already covered by other `../` future tasks (depend on, don't duplicate)

- `str.tostring` → `../str-utilities/`
- custom-symbol & cross-symbol `request.security` feeds →
  `../multi-symbol-security/` (+ `ignore_invalid_symbol`, and an
  `input.enum`-sourced symbol via **T4**)
- dynamic `bgcolor(cond ? … : na)` → `../bgcolor-barcolor-ergonomics/` D2 (+
  **T6** for the per-bar color)
- `timestamp(y,m,d,h,m)` → `../calendar-session-helpers/`; **`time_close`**
  should be **added to that task** (bar-close epoch accessor)

## TX index

| TX | Title | Primary package(s) | Surfaced by / Severity | Depends on |
|----|-------|--------------------|------------------------|-----------|
| [T1](./T1-udf-declarations/) | User-defined function declarations | pine-converter (+ maybe compiler) | TW 🔴 | — |
| [T2](./T2-nested-ta-lowering/) | Nested `ta.*` `.current` lowering | pine-converter | TW 🔴 silent | (compounds T1) |
| [T3](./T3-switch-multi-assign/) | `switch` branch comma multi-assignment | pine-converter | TW 🔴 | — |
| [T4](./T4-input-string-enum/) | `input.string/int(options=)` → `input.enum` **+ bare `input()` / source** | core + pine-converter | TW + MASM 🔴 | core `input.enum` numeric ext (new task 1) + array-literal parse |
| [T5](./T5-tuple-security/) | Tuple-returning `request.security` | pine-converter | TW 🔴 | `../multi-symbol-security/` + **T4** array-literal parse |
| [T6](./T6-color-transparency/) | 4-arg `color.rgb` / `color.new` → alpha | pine-converter | TW + MASM 🟠 silent | — |
| [T7](./T7-fill-to-fillbetween/) | `fill(plot/hline,…)` → `draw.fillBetween` | pine-converter | TW 🟠 | — |
| [T8](./T8-plot-visibility/) | Per-plot visibility + Pine `display=` | core + compiler + runtime + adapters + converter | TW + MASM 🟡 | `../bgcolor-barcolor-ergonomics/` D2 |
| [T9](./T9-leading-op-continuation/) | Leading-operator (`and`/`or`) line continuation | pine-converter (lexer/parser) | MASM 🔴 **general** | — |
| [T10](./T10-loop-break-continue/) | Loop `break`/`continue` + loop-body `+=` | pine-converter | MASM 🔴 **general** | — |
| [T11](./T11-alert-message-freq/) | `alert(message, freq)` + `alert.freq_*` | pine-converter | MASM 🔴 | — |
| [T12](./T12-nonnumeric-persistent-state/) | `var color` + `var bool/string` history (`state.series<bool>` / `state.color`) | core + runtime + converter | MASM 🔴 | (v6 migration eases bool) |

Severity legend: TW = Trend Wizard, MASM = MASM_Strat. **general** = breaks
most real-world Pine, not just the reference script.

Recommended order: **T9 + T10 first** (leading-op continuation and `break` are
prerequisites for converting almost *any* real script), then **T1 → T2**
(helpers + nested-ta), then the independent converter fixes (T3/T4/T6/T7/T11),
T5 after `multi-symbol-security`, and the core-spanning T8 + T12 last.

## Shared invariants (apply to every TX)

- **Every converter change ships a fixture triple** under
  `packages/pine-converter/fixtures/`: `NN-name.pine` +
  `NN-name.expected.chart.ts` + `NN-name.expected.diagnostics.json`. Clean
  conversions must pass the compile round-trip in
  `packages/pine-converter/src/tests/fixtures-compile.test.ts` (do **not**
  park them in `KNOWN_NON_COMPILING` unless genuinely deferred). Assign the
  next free `NN` via `ls fixtures` at implementation time — do not trust the
  illustrative numbers in task files.
- **Diagnostic codes are append-only** and are the public contract
  (`packages/pine-converter/src/diagnostics/codes.ts`,
  `DIAGNOSTIC_CODE_ENTRIES`). New codes are appended, never reordered/renamed.
- **100% line/branch/function coverage** per the package gate; parser-
  unreachable arms get synthetic-AST unit tests (established precedent).
- **Docs + skills update in the same PR**: `docs/converter/supported.md`,
  `docs/converter/rejects.md`, `docs/converter/diagnostics.md` (generated),
  and `packages/pine-converter/CLAUDE.md` invariants.
- **Mapping decisions route through `src/mapping/` tables**, never inlined in a
  transform (repo invariant).

## Cross-surface coverage

This is a **converter capstone**, so the six chartlang surfaces map differently
than they do for a new language primitive. How each TX covers them:

| Surface | How this capstone covers it |
|---------|-----------------------------|
| **converter** | The whole point — every TX is converter implementation (lexer/parser/semantic/mapping/transform/codegen). Primary surface. |
| **examples/demos** | The converter's "examples" are its **fixture triples** under `packages/pine-converter/fixtures/` (`NN-name.pine` + `.expected.chart.ts` + `.expected.diagnostics.json`), validated by the compile round-trip. The two reference scripts (`Trend_Wizard.md`, `MASM_Strat.md`) scope the corpus. Authored `examples/scripts/*.chart.ts` are **not** the converter's example surface — converted output is exercised via fixtures, not the demo catalogue. |
| **docs** | Mandated by the shared invariant: every TX updates `docs/converter/supported.md`, `docs/converter/rejects.md`, and the generated `docs/converter/diagnostics.md` in the same PR. |
| **skills** | Same shared invariant: each TX's mapping is reflected in the converter skill surface (`docs/converter/*` is the skill-facing reference; new Pine→chartlang rows land alongside the converter change). No `primitives.md` regeneration — the converter emits existing primitives. |
| **adapters** | **Only T8** (`display=` / per-plot visibility) touches adapters, because it adds a new wire field. Every other TX emits **existing** primitives (`plot`/`draw`/`input`/`alert`/…) that all adapters already render post `tasks/adapter-feature-parity/` — no adapter change. T8's adapter task enumerates all six adapters (canvas2d, echarts, konva, lightweight-charts, uplot, webgl — the sixth assuming `tasks/webgl-adapter/` landed). |
| **react-starter** | **N/A.** The converter is hosted in `apps/site` (the converter route / `CompilePreview`), not `apps/react-starter`. Converted chartlang output, when rendered, rides the same adapter parity as any other script — no react-starter wiring is specific to conversion. |

## Converter pipeline map (reference for all TX)

```
src/lexer/      tokenize (comments stripped; indent/newline + line continuation — T9)
src/parser/     statements.ts, expressions.ts (Pratt), cursor.ts
src/semantic/   analyze.ts (scopes, symbols, drawing camps, na flavour)
src/mapping/    INPUT_MAP, TA_PASSTHROUGH_MAP, MATH_PASSTHROUGH_MAP,
                MULTI_RETURN_TA_MAP, DRAWING_KIND_MAP, ENUM_VALUE_MAP
src/transform/  other.ts (control flow + non-drawing passthrough, .current
                lowering, emitContext.ts, exprEmit.ts, controlFlow.ts/emitFor),
                plotFamily.ts, inputs.ts, requestSecurity.ts, colorConvert.ts,
                campA/B/C, tables.ts, polylineLinefill.ts
src/codegen/    emit.ts (pure templating)
```

Slot-id model (relevant to T1): `<sourcePath>:<line>:<col>#<callIndex>`,
minted by `callsiteIdFor` in `packages/compiler/src/callsiteIdInjection.ts`;
the runtime keys per-script `ta.*`/`state` on this **lexical** string.

## Deferred / out of scope (won't-support, or other tasks)

- **`timenow`** (wall-clock server time, MASM alert window) — non-deterministic;
  the runtime forbids `Date`/ambient clocks. No deterministic equivalent →
  **won't-support**; converter should emit a clear reject, not silent output.
- **`time_close`** (bar-close epoch, MASM alert window) — tractable; **fold into
  `../calendar-session-helpers/`** as a bar-close accessor, not a task here.
- **Fundamental / earnings data** (MASM `request.security("ESD_FACTSET:"+…,
  'D', open, lookahead=on)`) — chartlang has no fundamental-data source, and
  computed-symbol + `lookahead` are rejected by `../multi-symbol-security/`.
  **Won't-support**; MASM's earnings-based `Long Exit C2` cannot be faithfully
  converted (drop the condition). Converter should reject, not silently read
  chart `open`.
- Pine `strategy(...)` backtesting (converter downgrades to indicator today).
- UDTs (`type`), `method`, `import`/`library` (hard-rejected at parse).
- DST/exchange-timezone MTF alignment (see `../calendar-session-helpers/`).
