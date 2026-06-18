# Pine v6 → chartlang Drawing Converter (v1)

> **Plan reference:** First slice of a Pine Script v6 → chartlang
> source-to-source converter, scoped to the **drawing** surface of Pine
> (`line.*`, `label.*`, `box.*`, `table.*`, `polyline.*`, `linefill.*`)
> plus the minimum supporting infrastructure (indicator declaration,
> inputs, `var`/`varip` persistence, `barstate`, literal-bounded
> control flow) required to host real-world drawing scripts. Non-drawing
> Pine surfaces (full `ta.*`/`math.*` mapping, `strategy.*` backtester,
> MTF `request.*`, matrices/maps/UDT methods) are out of scope for v1
> and ride the diagnostic-rejection rails laid down here.
>
> **Package target:** new workspace package `packages/pine-converter`
> (forward-compatible name — this v1 ships the drawing slice; later
> slices extend the same package).
>
> **Version target:** `0.1.0` for `@invinite-org/chartlang-pine-converter`.
> No version bump on existing chartlang packages — this v1 is purely
> additive and consumes the existing public surface of `core`,
> `compiler`, `runtime`.
>
> **Scope decision:** "Everything attemptable" per the user's choice.
> Covers Camp A (single-handle), Camp B (bounded ring buffer), and
> best-effort heuristics for Camp C (dynamic collections) with clear
> hard-reject diagnostics for the irreducible cases.

## Goal

Ship a deterministic, source-to-source converter that takes a Pine
Script v6 indicator using the drawing surface and emits an equivalent
`.chart.ts` chartlang script that compiles through
`@invinite-org/chartlang-compiler` and produces semantically-equivalent
drawing emissions at runtime. Where Pine idioms cannot be faithfully
translated, emit a structured diagnostic with the source span and a
suggested manual rewrite — never silently produce wrong output.

## Current State

- chartlang has **no Pine-source ingestion path**. The compiler entry
  is `compile(source: string, opts) → CompiledScript` where `source`
  is TypeScript (`.chart.ts`). The runtime, hosts, adapters, and skills
  all assume the chartlang TS authoring surface.
- chartlang's drawing surface is fully built out (`packages/core/src/draw/`,
  62 kinds, mutable `DrawingHandle` with `.update()`/`.remove()`,
  callsite-stable identity, per-bucket `maxDrawings` caps mirroring
  Pine's `max_*_count` GC, `subIdAllocator` enabling literal-bounded
  loops to produce stable handle IDs across bars).
- `packages/conformance/src/scenarios/` carries ~80 drawing scenarios
  including `drawInteractiveUpdate.scenario.ts` (the canonical
  cross-bar mutable-handle test) and `drawHandleRemove.scenario.ts`.
- chartlang's authoring rules (`skills/chartlang-coding/references/forbidden.md`)
  reject `while`, `for...of`, `for...in`, and non-literal `for` bounds —
  the exact constraints the converter must enforce on its output.
- No Pine parser exists in the workspace. No third-party Pine grammar
  is consumed.

## Target State

After all 20 tasks land:

### New package `packages/pine-converter`

- Scaffolded via `pnpm scaffold` (PACKAGE_DIRS append in
  `scripts/scaffold.ts`).
- Public surface:
  - `convert(source: string, opts?: ConvertOpts) → ConvertResult` —
    pure synchronous conversion of one Pine v6 script string to a
    chartlang `.chart.ts` source string + a structured diagnostics array.
  - `convertFile(path: string, opts?) → Promise<ConvertResult>` —
    convenience over `convert` that reads from disk.
  - Types: `ConvertOpts`, `ConvertResult`, `Diagnostic`,
    `DiagnosticSeverity`, `SourceSpan`, `ConverterCapabilities`.
- Internal module layout:
  - `src/lexer/` — Pine v6 tokenizer with indentation tracking
  - `src/parser/` — recursive-descent parser producing Pine AST
  - `src/ast/` — Pine AST node type definitions
  - `src/semantic/` — scope resolution, qualifier inference, `var`/
    `varip` lifetime analysis, drawing-camp classification
  - `src/mapping/` — declarative tables (drawings, enums, inputs,
    `ta.*` passthrough, `math.*` passthrough)
  - `src/transform/` — IR transforms (declaration → script wrapper,
    drawing-handle reshape, coordinate-model resolution, …)
  - `src/codegen/` — chartlang TS emitter
  - `src/diagnostics/` — structured diagnostic codes + formatting
  - `src/cli.ts` — `pnpm pine-convert <input.pine>` driver
  - `src/index.ts` — public exports + `PACKAGE_VERSION`

### Reach into existing packages

- `scripts/scaffold.ts` — append `"packages/pine-converter"` to
  `PACKAGE_DIRS` and update `DESCRIPTIONS`/`PUBLIC_SURFACE` maps.
- `packages/cli` — register `pine-convert` subcommand wrapping the
  converter (Task 18).
- `packages/conformance/src/scenarios/` — three new scenarios that
  ingest a Pine fixture, run the converter, compile the output through
  `@invinite-org/chartlang-compiler`, run it through the runtime, and
  assert the resulting drawing-emission stream matches a golden
  trace (Task 19).
- `skills/chartlang-coding/references/` — extend with a "translating
  from Pine" reference page (Task 20).

### Convertible Pine surface (v1)

- Top-level declarations: `//@version=6`, `indicator(title, ...)` →
  `defineIndicator({...})` or `defineDrawing({...})` (chosen per the
  presence of plot vs drawing-only emissions).
- `input.int`, `input.float`, `input.bool`, `input.string`, `input.color`,
  `input.source`, `input.symbol`, `input.timeframe`, `input.price`,
  `input.time` → chartlang `input.*`.
- All six Pine drawing object types (`line`, `label`, `box`, `table`,
  `polyline`, `linefill`) with the Camp A / Camp B mappings + Camp C
  diagnostics defined in Tasks 10–14.
- `barstate.isfirst`/`islast`/`isnew`/`ishistory`/`isrealtime`/
  `isconfirmed` → chartlang `barstate.*`.
- `var` / `varip` declarations of drawing handles → converter-owned
  module-level handle closures (Tasks 5, 10). Scalar `var` / `varip`
  values use `state.*` / `state.tick.*`.
- `if`/`else if`/`else`; `for i = a to b [by step]` with literal
  bounds; ternary `?:`; `:=` reassignment.
- Pass-through of `ta.*` / `math.*` / OHLCV references that already
  have a 1:1 chartlang analogue (mapping table in Task 6); anything
  outside the table emits a warning diagnostic and leaves the call
  textually unchanged with a TODO marker.

### Hard-reject surface (v1)

Every rejection emits a structured diagnostic with source span and
suggestion — the converter does not silently drop or guess. Hard-rejects:

- `strategy(...)` declarations — diagnostic suggests stripping the
  backtester and converting the signal logic only.
- `library(...)` declarations — out of scope for v1.
- Mutable collections of drawing handles addressed by data-dependent
  iteration over `array<line/label/box>` (Camp C unmapped) — covered
  in Task 12.
- `for ... in array_var`, `for ... in line.all`, `while`, `do ...
  while` loops.
- `array<chart.point>`-driven polyline rebuild with dynamic length
  (Task 14).
- `linefill.new(a, b)` where `a` and `b` are dynamically selected
  from a collection (Task 14).
- UDT (`type ...`) declarations, `method ...` declarations,
  `request.financial`/`economic`/`dividends`/`earnings`/`quandl`,
  `matrix.*`, `map.*`.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **New `packages/pine-converter` package, not a feature inside `compiler`** | Different layer: this tool ingests a foreign source language and emits chartlang TS source. The compiler then consumes that TS. Keeping them separate preserves the compiler's narrow surface and lets the converter ship its own coverage / version cycle. |
| **Hand-rolled recursive-descent parser, no third-party grammar** | Pine v6 is small enough (a few hundred grammar productions) that hand-rolling gives us full control over diagnostics (line/col + suggested fix), the indentation handling, and the v6-vs-v5 disambiguation. No external Pine parser in the JS/TS ecosystem is both v6-current and deterministically maintained. Avoids a dependency we cannot upgrade through. |
| **Output is a chartlang TS source string, not a chartlang AST or compiled bundle** | Round-tripping through `@invinite-org/chartlang-compiler` reuses every existing chartlang gate (forbidden constructs, slot injection, manifest emit, JSDoc, coverage). The converter never has to know the compiler's internals; conformance follows for free. |
| **Drawing-camp classification at semantic-analysis time, not codegen** | Whether a `line.new` site is Camp A (single `var` mutated), Camp B (bounded collection), or Camp C (dynamic collection) is a property of the source. Classifying once in semantic analysis means transform/codegen each operate on a normalized IR and don't have to re-analyze. |
| **Coordinate resolution requires a `barInterval` (ms) input** | chartlang anchors are `(time, price)` only; Pine `xloc.bar_index + N` future anchors must be synthesized as `bar.time + N * barInterval`. The converter takes `barInterval` as a `ConvertOpts` field, defaulting to `null` — when null, future-bar arithmetic emits a diagnostic requiring the caller to supply it. Historical `bar_index` references convert via a runtime helper that reads from the bar stream. |
| **Hard-reject over best-guess for the dynamic-collection cliff** | Pine `array<line>` with data-dependent count has no faithful chartlang analogue when the count exceeds the per-bucket cap or addresses handles by index that doesn't survive across bars. Task 12 ships a heuristic for the *bounded-by-`max_lines_count`* common case (fold into Camp B); everything else rejects with a clear suggestion. Silent wrong output is worse than refusal. |
| **Diagnostics are structured (code + span + suggestion), not free-text** | Enables future tooling (editor squigglies, batch-conversion reports, gate scripts). Codes are stable and form the converter's public contract. |
| **`var`/`varip` of a drawing handle is rewritten to a module-level handle closure + handle creation guarded by `barstate.isfirst` or the original creation branch** | chartlang's `state.*` namespace only ships scalar slots (`float`/`int`/`bool`/`string`). Drawing handles are persisted across `compute(...)` calls with converter-owned closures (`useDrawingHandleSlot` / `useDrawingHandleRing`), matching the existing mutable-handle idiom in `drawInteractiveUpdate.scenario.ts`. Scalar `varip` values still map to `state.tick.*`; handle `varip` emits an approximation diagnostic. |
| **Pine API enums (`line.style_dashed`, `label.style_circle`, `size.large`, etc.) compile to chartlang literal strings via a single declarative table** | Centralizes the enum vocabulary so future Pine versions add one line per new enum value. Mapping table lives in `src/mapping/enums.ts` (Task 6). |
| **Camp B emits a SINGLE `draw.<kind>(…)` callsite inside the original Pine guard, plus a module-level ring helper that stores up to K handles** | chartlang's runtime `subIdAllocator` (`packages/runtime/src/emit/draw/subIdAllocator.ts`) gives each callsite a stable per-bar id. The compiler's `stateful-call-inside-loop` gate (`packages/compiler/src/analysis/statefulCallInLoop.ts`) rejects `draw.*` inside ANY loop — no literal-bound carveout. The converter therefore keeps the `draw.<kind>(...)` callsite at the source position of Pine's `array.push(...)` (e.g. inside `if (pivotHighDetected) { … }`) — exactly ONE callsite, NOT K unrolled callsites. The returned handle is pushed into a module-level ring (`useDrawingHandleRing<K extends string>(cap)`) whose internal write pointer rotates modulo K, calling `.remove()` on the displaced handle. Loop-driven UPDATES of ring elements (`for (let i = 0; i < K; i++) __ring.at(i)?.update(...)`) are allowed because `.update()` is a method on a handle, not a stateful primitive call. K = `min(pineCap, chartlangBucketCap)`. |

## Dependency Graph

```
1 (scaffold + structure)
  │
  v
2 (lexer)
  │
  v
3 (parser: decls + statements)
  │
  v
4 (parser: expressions + UDT reject)
  │
  v
5 (semantic analysis)
  │
  v
6 (mapping tables)  ──┐
  │                   │
  v                   │
7 (coordinate resolver)
  │
  v
8 (transform: declarations) ──┐
  │                            │
  v                            │
9 (transform: inputs)
  │
  v
10 (transform: Camp A drawings)
  │
  v
11 (transform: Camp B drawings)
  │
  v
12 (transform: Camp C + dynamic-reject)
  │
  v
13 (transform: tables)
  │
  v
14 (transform: polyline + linefill)
  │
  v
15 (transform: control flow + ta/math passthrough)
  │
  v
16 (codegen: chartlang TS emit)
  │
  v
17 (diagnostics framework)
  │
  v
18 (CLI + programmatic API)
  │
  v
19 (golden + integration tests)
  │
  v
20 (docs + skill updates)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Scaffold `pine-converter` + initial structure + mapping seed](./1-scaffold-pine-converter.md) | pine-converter, scripts | — | Medium |
| 2 | [Pine v6 lexer (with indentation tracking)](./2-pine-lexer.md) | pine-converter | 1 | High |
| 3 | [Pine v6 parser: AST + declarations + statements](./3-parser-decls-statements.md) | pine-converter | 2 | High |
| 4 | [Pine v6 parser: expressions + history op + UDT reject](./4-parser-expressions.md) | pine-converter | 3 | High |
| 5 | [Semantic analysis: scope + qualifiers + drawing-camp classification](./5-semantic-analysis.md) | pine-converter | 4 | High |
| 6 | [Mapping tables: drawings + enums + inputs + ta/math passthrough](./6-mapping-tables.md) | pine-converter | 1 | Medium |
| 7 | [Coordinate resolver: bar_index ↔ time + future-bar synthesis](./7-coordinate-resolver.md) | pine-converter | 5, 6 | Medium |
| 8 | [Transform: declarations → `defineIndicator`/`defineDrawing` wrapper](./8-transform-declarations.md) | pine-converter | 7 | Medium |
| 9 | [Transform: `input.*` primitives](./9-transform-inputs.md) | pine-converter | 8 | Low |
| 10 | [Transform: Camp A drawings (single-handle, mutated each bar)](./10-transform-camp-a.md) | pine-converter | 9 | High |
| 11 | [Transform: Camp B drawings (bounded ring buffer)](./11-transform-camp-b.md) | pine-converter | 10 | High |
| 12 | [Transform: Camp C heuristics + hard-reject diagnostics](./12-transform-camp-c-reject.md) | pine-converter | 11 | Medium |
| 13 | [Transform: tables (`table.new` → `draw.table`)](./13-transform-tables.md) | pine-converter | 12 | Medium |
| 14 | [Transform: `polyline` + `linefill`](./14-transform-polyline-linefill.md) | pine-converter | 13 | Medium |
| 15 | [Transform: control flow + minimal `ta.*`/`math.*` passthrough](./15-transform-control-flow-passthrough.md) | pine-converter | 14 | Medium |
| 16 | [Codegen: chartlang TS emitter](./16-codegen-ts-emit.md) | pine-converter | 15 | High |
| 17 | [Diagnostics framework + source-span propagation](./17-diagnostics-framework.md) | pine-converter | 16 | Medium |
| 18 | [CLI subcommand + programmatic API](./18-cli-and-api.md) | pine-converter, cli | 17 | Medium |
| 19 | [Golden + integration tests (Pine → TS → compile → emit)](./19-golden-and-integration-tests.md) | pine-converter, conformance | 18 | High |
| 20 | [Documentation + skill updates](./20-docs-and-skills.md) | docs, skills | 19 | Low |

## Code Reuse

| Symbol / Module | Source | Used By |
|---|---|---|
| `compile(source, opts)` → `CompiledScript` | `@invinite-org/chartlang-compiler` | Task 19 (round-trip integration tests) |
| `defineIndicator` / `defineDrawing` types | `@invinite-org/chartlang-core` | Task 8 (declaration transform), Task 16 (codegen targets) |
| `InputSchema`, `InputDescriptor` types | `@invinite-org/chartlang-core` | Task 9 (input transform) |
| `DrawNamespace`, `DrawingHandle`, `DrawingKind` types | `@invinite-org/chartlang-core` | Tasks 10–14 (drawing transforms) |
| `WorldPoint`, `AnchorPair`, `AnchorTriple`, etc. | `@invinite-org/chartlang-core` (`draw/worldPoint.ts`) | Task 7 (coordinate resolver) |
| `state.float/int/bool` + `state.tick.*` | `@invinite-org/chartlang-core` | Task 10 (Pine `var`/`varip` scalar values → state slot; **drawing handles use module-level `let` closures, NOT `state.*`** because no handle-typed slot exists) |
| `barstate.*` view | `@invinite-org/chartlang-core` | Task 8 (declaration), Task 10 (handle gating) |
| `pnpm scaffold` (`scripts/scaffold.ts`) | scripts | Task 1 (package creation) |
| `Scenario` + `ScenarioAssertion` types (plain object literals; no `defineScenario` builder exists) | `@invinite-org/chartlang-conformance` (`runConformanceSuite.ts`) | Task 19 (round-trip scenarios — use `id`, `title`, `inlineSource`, `intervalCount`, and `assertions: ReadonlyArray<ScenarioAssertion>` with kinds `drawing-hash`, `diagnostic-code-absent`, etc.) |
| `createScriptRunner` (NOT `createRuntime`) + `runner.drain(): RunnerEmissions` | `@invinite-org/chartlang-runtime` | Internal to Task 19's harness (scenarios don't drive the runtime themselves — `runConformanceSuite` does) |
| `skills/chartlang-coding/references/primitives.md` | skills | Task 20 (cross-link from new Pine page) |

Every Pine→chartlang mapping decision routes through the declarative
tables in `src/mapping/` (Task 6). No conversion logic is duplicated
across transform tasks — each transform task consumes the same shared
mapping module.

## Provenance

This is greenfield code — no port from `../invinite/`. The Pine v6 API
data baked into `src/mapping/` is derived from the official TradingView
v6 reference manual (`https://www.tradingview.com/pine-script-reference/v6/`)
and the v6 documentation set (`https://www.tradingview.com/pine-script-docs/`).
Each mapping table entry carries a comment pointing at the source doc
page.

## Deferred / Follow-Up Work

- Full `ta.*` mapping beyond the v1 passthrough subset (Pine has ~55
  `ta.*` members; chartlang has 96 with broader signatures — a complete
  mapping table is its own multi-task effort).
- `strategy.*` backtester → chartlang signal-only downgrade with
  `alert(...)` emission for entry/exit points.
- `request.security` / `request.security_lower_tf` → chartlang
  `request.security` / `request.lowerTf` (the chartlang surface
  exists; mapping is non-trivial because of Pine's repainting and
  lookahead semantics).
- UDT (`type ...`) and method (`method ...`) declarations: would
  require a structural-record IR and an inliner pass.
- `array.*` (~54), `map.*` (~10), `matrix.*` (~47) — out of scope
  pending a chartlang collection primitive (none exists today).
- Editor integration: surface converter diagnostics live in the
  chartlang editor when a `.pine` file is opened, suggest "Convert
  to chartlang" code action.
- Web-based converter playground in `apps/site` — drop in Pine, see
  output side-by-side with diagnostics.
- A second pass on `linefill` once chartlang ships a dedicated
  fill-between-series primitive (currently `linefill` v1 best-effort
  uses `draw.path` + `ShapeStyle.fill`).
- Version bump path: `apiVersion: 1` is hard-coded; a future Pine v7
  would require either a versioned mapping table or a v6-mode flag.
