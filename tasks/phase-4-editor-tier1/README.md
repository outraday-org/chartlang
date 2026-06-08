# Phase 4 — `0.4` Editor + Inputs + Timeframes + Tier-1 Pine Parity

> **Plan reference:** PLAN.md §19 Phase 4, with cross-cuts into §4.5
> (timeframes), §4.6–§4.9 (state / barstate / syminfo / timeframe),
> §12 (inputs), §14 (language service + editor), §7.2 (capabilities
> triad), §17.2 (JSDoc registry), §22.10 (per-port landing rule).
> **Prerequisite:** Phase 3 drawing parity (`0.3`) shipped — see
> `tasks/phase-3-drawing-parity/README.md`.
> **Version target:** `0.4` (per-package). `apiVersion: 1` script
> header unchanged (Phase 4 is additive at runtime).

## Goal

A chartlang script author opens an editor and sees inline
diagnostics, completions, and hover docs. Scripts declare typed
inputs, pick a main timeframe, and use the Tier-1 Pine ergonomics
(`state.*`, `barstate.*`, `syminfo.*`, `timeframe.*`,
`defineIndicator` overrides). The median Pine indicator can be
rewritten in chartlang without reaching for unmodelled features.

`request.security({ interval })` lands as a **typed surface + NaN
fallback** — the public type, the compile-time literal-only pass
(§5.6), `manifest.requestedIntervals` extraction, and the runtime
NaN-secondary-bar stub. The HTF time-alignment kernel (§6.8 port
of `align-htf-series-to-ltf.ts`) ships in Phase 5 when adapters
flip `Capabilities.multiTimeframe: true`.

## Current State

Phase 3 left the repo at:

- `@invinite-org/chartlang-core` exports the full `draw.*` namespace,
  the 61-entry `DrawingKind` union, `DrawingState`, `DrawingHandle`,
  `STATEFUL_PRIMITIVES` cardinality **154** (93 Phase-2 ta/plot/hline/
  alert + 61 Phase-3 draw kinds).
- `packages/core/src/types.ts` declares `Bar`, `Series<T>`, `Color`,
  `LineStyle`, `PlotLineStyle`, `AlertSeverity`, `IntervalDescriptor`,
  `InputSchema` (opaque `Readonly<Record<string, unknown>>`),
  `CapabilityId`, `DrawingCounts`, `ScriptManifest` (with
  `requestedIntervals`, `userPickableInterval`, `maxDrawings?`).
- `packages/core/src/define/` ships `defineIndicator`, `defineDrawing`,
  `defineAlert` with the Phase-3 `maxDrawings?: DrawingCounts` opt.
- `packages/core/src/index.ts` re-exports the namespace barrels.
- `packages/adapter-kit/src/types.ts` exports `Capabilities` with
  all 13 fields declared: `plots`, `drawings`, `alerts`,
  `alertConditions`, `logs`, `inputs`, `intervals`, `multiTimeframe`,
  `subPanes`, `symInfoFields`, `maxDrawingsPerScript`, `maxLookback`,
  `maxTickHz`. The Phase-4 triad shape is already in place (Phase 3
  closeout); Phase 4 tightens canvas2d's populated values and lands
  the matching `capabilities.*` builders.
- `packages/adapter-kit/src/capabilities/capabilities.ts` ships
  Phase-2 plot + Phase-3 drawing builders + category groupers. No
  `intervals` / `multiTimeframe` / `subPanes` / `symInfoFields` /
  `maxDrawingsPerScript` / `alertConditions` / `logs` builder
  exists yet.
- `packages/adapter-kit/src/types.ts` `SymInfoField` literal union
  is already declared (`"ticker" | "type" | "mintick" | "currency"
  | "basecurrency" | "exchange" | "timezone" | "session" | "meta"`).
- `packages/adapter-kit/src/types.ts` `DiagnosticCode` already
  includes `unsupported-interval`, `multi-timeframe-not-supported`,
  `input-coercion-failed`, plus 11 other codes. Task 11 / Task 12
  consume these directly; no new diagnostic-code additions in
  adapter-kit.
- `packages/compiler/src/analysis/extractInputs.ts` is a stub
  returning `{ inputs: {}, userPickableInterval: false }`.
- `packages/compiler/src/program.ts` carries an ambient `.d.ts` shim
  pinning every core export the compiler resolves against — needs
  Phase-4 extensions for `input.*`, `state.*`, `state.tick.*`,
  `barstate`, `syminfo`, `timeframe`, `request.security`.
- `packages/compiler/src/analysis/extractCapabilities.ts` walks the
  AST for `alert` calls; needs extension for `requestedIntervals`
  via §5.6 literal-only pass.
- `packages/runtime/src/runtimeContext.ts` carries `RuntimeContext`
  with `stream`, `stateStore`, `capabilities`, `emissions`, drawing
  slot / sub-id / bucket counters. Needs extension for state slot
  store wiring, view objects (`barstate` / `syminfo` / `timeframe`),
  and the resolved `inputs` bag.
- `packages/runtime/src/buildComputeContext.ts` wires up the
  `ComputeContext` (bar, ta, plot, hline, alert, draw, …).
- `packages/runtime/src/stateStore.ts` ships `StateStore` +
  `inMemoryStateStore()` — Phase 4 reuses this for `state.*` slot
  persistence.
- `packages/runtime/src/streamState.ts` owns `Bar` / `Series<T>`
  population from candle events — Phase 4 derives `barstate.*` and
  `timeframe.*` from its head-bar bookkeeping.
- `packages/language-service/src/index.ts` is a placeholder
  exporting `PACKAGE_VERSION = "0.0.0"`. No real surface.
- `packages/editor/src/index.ts` is a placeholder exporting
  `PACKAGE_VERSION = "0.0.0"`. No real surface.
- `examples/canvas2d-adapter/src/capabilities.ts` ships every
  `Capabilities` field but with weak Phase-3 defaults: 3-entry
  `intervals` using non-canonical `group: "intraday"`, `subPanes:
  0`, empty `symInfoFields`, `alertConditions: false`,
  `logs: false`, `multiTimeframe: false`, `maxDrawingsPerScript`
  populated. Phase 4 retunes these: 6-entry `intervals` with
  canonical groups (`"minute"` / `"hour"` / `"daily"` / `"weekly"`),
  `subPanes: Number.MAX_SAFE_INTEGER`, full `symInfoFields` set.
- `packages/conformance/src/scenarios/` ships every Phase-2 and
  Phase-3 scenario. Phase 4 adds state / barstate / syminfo /
  timeframe / input-interval / request-security-NaN scenarios.
- `examples/scripts/` ships 4 Phase-1/Phase-3 example scripts. Phase
  4 adds three median Pine indicator ports.

## Target State

After Phase 4 closes:

- **Core** exports `input.*` (12 builders), `state.*` + `state.tick.*`
  (4+4 builders + `MutableSlot<T>` shape), `barstate` (const view),
  `syminfo` (const view + `SymbolType`), `timeframe` (const view),
  `request.security({ interval })` (typed namespace returning a
  `Bar`-shape). `defineIndicator` accepts `maxBarsBack`, `format`,
  `precision`, `scale`, `requiresIntervals`, `shortName`.
- **STATEFUL_PRIMITIVES** cardinality grows from **154** → **163**:
  154 carried over + 8 new `state.*` / `state.tick.*` entries + 1
  new `request.security` entry. Test asserts `.size === 163`.
- **Adapter-kit** `Capabilities` carries the full triad —
  `intervals: ReadonlyArray<IntervalDescriptor>`,
  `multiTimeframe: boolean`, `subPanes: number`,
  `symInfoFields: ReadonlySet<SymInfoField>`,
  `maxDrawingsPerScript: DrawingCounts` (Phase-3 declared the
  builder; this phase pins the canonical shape on `Capabilities`),
  `alertConditions: boolean`, `logs: boolean`. New builders ship.
- **Compiler** extracts `manifest.inputs` from `input.*` calls at
  `defineIndicator({ inputs: { ... } })`, sets
  `userPickableInterval` when any `input.interval()` is present,
  populates `manifest.requestedIntervals` from `request.security`
  literal-only intervals, fails compilation with
  `request-security-interval-not-literal` on dynamic intervals.
  Ambient shim extends in lockstep.
- **Runtime** wires `state.*` / `state.tick.*` slot store with
  two-phase committed/tentative semantics + snapshot/restore;
  populates `barstate.*` / `syminfo.*` / `timeframe.*` views per
  bar; runs `request.security` as a NaN-secondary-bar stub with
  `multi-timeframe-not-supported` + `unsupported-interval`
  diagnostics; resolves `inputs.*` from adapter-supplied overrides.
- **Language-service** ships a hover-doc registry generated from
  core JSDoc at build time and a `createLanguageService(opts)`
  with `compileToDiagnostics` / `getCompletions` / `getHoverDoc` /
  `getSignatureHelp` / `getDefinition` / `getAvailableIntervals`.
  Capability-aware completion inside `interval` string literals.
- **Editor** ships a framework-agnostic CM6 factory
  `createChartlangEditor(opts)` from the bare entry, plus a
  `<ChartlangEditor />` React component and a headless
  `renderInputsForm(...)` + React `<InputsForm />` from the
  `/react` sub-export.
- **canvas2d-adapter** declares the full Phase-4 capability triad
  with `multiTimeframe: false`, a 6-entry default `intervals`
  list, `subPanes: Number.MAX_SAFE_INTEGER`, the full
  `symInfoFields` set, and `maxDrawingsPerScript` matching its
  Phase-3 bucket caps.
- **Conformance** ships 8 new scenarios + 3 Pine-port example
  scripts, covering state cold/warm round-trip, barstate /
  syminfo / timeframe per-field hashes, the `input.interval` flow,
  `request.security` NaN-fallback, and capability-triad gating.
- **Docs / READMEs** regenerate; `pnpm docs:check` /
  `pnpm readme:check` stay green. Every public surface carries
  `@since 0.4` JSDoc + an `@example` that compiles.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`<ChartlangEditor />` ships at `/react` sub-export, not the bare entry** | Bare `@invinite-org/chartlang-editor` stays framework-agnostic — Monaco / vanilla / Solid hosts consume the CM6 factory without pulling React. React-using hosts import `@invinite-org/chartlang-editor/react`. Confirmed via `AskUserQuestion`. |
| **Inputs UI ships headless renderer + React component** | `renderInputsForm(manifest, value, onChange)` returns a typed ViewModel reusable by non-React hosts; `<InputsForm />` is a thin React binding. Mirrors the language-service / editor split. Confirmed via `AskUserQuestion`. |
| **`request.security` ships typed surface + NaN fallback only in 0.4** | The HTF time-alignment kernel (§6.8 port of `align-htf-series-to-ltf.ts`) is non-trivial and only matters when `multiTimeframe: true`. Adapters typically ship `false` in 0.4 → secondary bar is all-NaN, `multi-timeframe-not-supported` diagnostic fires. Phase 5 lands the kernel + flips the flag. Confirmed via `AskUserQuestion`. |
| **`defineIndicator` overrides and Capabilities triad are separate tasks** | The script-author override surface (Task 4) edits `defineIndicator` opts + manifest passthrough; the adapter capability triad (Task 6) edits `Capabilities` + builder set + canvas2d wiring. Different files, different reviewers. Confirmed via `AskUserQuestion`. |
| **`state.*` slots use the existing `inMemoryStateStore` + slot-id format** | The runtime already keys per-script state on the compiler-injected slot id (§5.5). `state.*` adds `${slotId}:state` keys carrying `{ committed, tentative }` JSON-clean values. No new persistence contract — Phase 5's `PersistentStateStore` will snapshot/restore these alongside `ta.*` slots. |
| **`barstate.*` / `syminfo.*` / `timeframe.*` are property accesses, not slot-keyed primitives** | They read from a per-bar view bound to `ComputeContext`; no callsite-id needed. `STATEFUL_PRIMITIVES` does NOT carry them — only the `state.*` / `state.tick.*` builders + `request.security` get appended. The compiler's `extractCapabilities` flags scripts that touch them so the runtime can populate the view. |
| **Hover-doc registry is a build-time TS AST pass over `@invinite-org/chartlang-core`** | The language-service is consumed at runtime; the hover registry must be precomputed. A `scripts/gen-hover-registry.ts` walks core's `.d.ts` + `.ts` sources, extracts JSDoc into a `{ fqn → HoverDoc }` JSON map, and writes it to `packages/language-service/src/hoverRegistry.generated.ts`. CI regenerates on every PR and fails on diff — same posture as `docs:generate`. |
| **`getCompletions` inside string literals uses `targetCapabilities.intervals`** | When the cursor sits inside `request.security({ interval: "▮" })` or `input.interval("▮")`, the completion source returns one item per `intervals` entry. Without `targetCapabilities`, the function returns the bare core-symbol completions and skips the interval list. |
| **`maxDrawingsPerScript` canonical type lives in `adapter-kit.Capabilities`** | Core already exports `DrawingCounts` (Phase 3) and re-uses it for `ScriptManifest.maxDrawings?`. Phase 4 adds `Capabilities.maxDrawingsPerScript: DrawingCounts` so the runtime's `min(script, adapter)` reduction has a stable shape on both sides. The Phase-3 stub already wires the runtime budget enforcement against this field. |
| **Universal `opts.offset` is verified, not introduced** | Phase 2 Task 29 backfilled `opts.offset` across every `ta.*` primitive. Task 12 audits the surface to confirm 100% coverage (no `ta.*` missed) and ships any gap-fix patches alongside `ta.nz` verification. |
| **`state.*` / `request.security` runtime impls accept `slotId` as their first parameter** | Mirrors the established `ta.*` primitive pattern (see `packages/runtime/src/ta/sma.ts`): the compiler injects `__slot` as a synthetic first arg via `transformers/callsiteIdInjection.ts`; the runtime impl reads `slotId: string` as its first parameter and uses it to key into `RuntimeContext.stateSlots` / `requestSecurityBars`. No `_lib/slot.ts` helper exists — slot id is a positional parameter, not an extracted artifact. |
| **`IntervalDescriptor.intervalSeconds?` is deferred** | PLAN §4.9 sketches an optional adapter override for exotic intervals (`"3D"`, `"1Q"`). Phase 4 derives `timeframe.inSeconds` from `IntervalDescriptor.group × numeric prefix(value)` only; widening the descriptor type is Phase 5 work that can land additively without changing the Phase-4 contract. |
| **Canvas2d intervals are re-keyed to canonical PLAN §4.9 groups** | Phase-3 canvas2d used ad-hoc `group: "intraday"`. Phase 4 normalises every interval entry to one of `"second" / "minute" / "hour" / "daily" / "weekly" / "monthly" / "quarterly" / "yearly"` so `timeframe.isintraday` / `isdaily` / `isweekly` / `ismonthly` derivations stay table-driven. |

## Dependency Graph

```
1 core-input-builders
  |
  v
2 core-state-slots
  |
  v
3 core-views (barstate / syminfo / timeframe)
  |
  v
4 core-define-overrides
  |
  v
5 core-request-security
  |
  v
6 adapter-kit-capabilities-triad
  |
  v
7 compiler-inputs-extraction --------+
  |                                  |
  v                                  |
8 compiler-request-security-pass     |
  |                                  |
  v                                  v
9 runtime-state-slots          10 runtime-views
  |                                  |
  +----------------+-----------------+
                   |
                   v
            11 runtime-request-security
                   |
                   v
            12 runtime-inputs-and-offset
                   |
                   v
            13 language-service
                   |
                   v
            14 editor-cm6-shell
                   |
                   v
            15 editor-react-and-inputs-ui
                   |
                   v
            16 conformance-scenarios
                   |
                   v
            17 example-pine-ports
                   |
                   v
            18 phase-closeout
```

Execution is strictly sequential — Tasks 9 and 10 run in series
(both touch `RuntimeContext`; serial execution keeps merges
clean).

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|------------|--------------|-----------------|
| 1 | [Core: `input.*` builders + `InputDescriptor` types](./1-core-input-builders.md) | core | None | Medium |
| 2 | [Core: `state.*` / `state.tick.*` + `MutableSlot` + `STATEFUL_PRIMITIVES`](./2-core-state-slots.md) | core | 1 | Medium |
| 3 | [Core: `barstate` / `syminfo` / `timeframe` views + `SymbolType`](./3-core-views.md) | core | 2 | Medium |
| 4 | [Core: `defineIndicator` overrides + `ScriptManifest` extensions](./4-core-define-overrides.md) | core | 3 | Low |
| 5 | [Core: `request.security` typed namespace](./5-core-request-security.md) | core | 4 | Low |
| 6 | [Adapter-kit: Capabilities triad + builders + canvas2d wiring](./6-adapter-kit-capabilities-triad.md) | adapter-kit, examples/canvas2d-adapter | 5 | Medium |
| 7 | [Compiler: `input.*` extraction + ambient shim](./7-compiler-inputs-extraction.md) | compiler | 6 | High |
| 8 | [Compiler: `request.security` literal-only pass + STATEFUL\_PRIMITIVES additions](./8-compiler-request-security-pass.md) | compiler | 7 | High |
| 9 | [Runtime: `state.*` slot store + tentative/committed phases + snapshot/restore](./9-runtime-state-slots.md) | runtime | 8 | High |
| 10 | [Runtime: `barstate` / `syminfo` / `timeframe` view wiring](./10-runtime-views.md) | runtime | 9 | Medium |
| 11 | [Runtime: `request.security` typed runtime + NaN-fallback](./11-runtime-request-security.md) | runtime | 10 | Medium |
| 12 | [Runtime: `input.*` resolution + universal `opts.offset` audit](./12-runtime-inputs-and-offset.md) | runtime | 11 | Medium |
| 13 | [Language-service: hover registry + LSP-style API](./13-language-service.md) | language-service | 12 | High |
| 14 | [Editor: CM6 shell + Lezer TS grammar + extensions](./14-editor-cm6-shell.md) | editor | 13 | High |
| 15 | [Editor `/react` sub-export + Inputs UI](./15-editor-react-and-inputs-ui.md) | editor | 14 | High |
| 16 | [Conformance scenarios: state / barstate / syminfo / timeframe / inputs / request.security](./16-conformance-scenarios.md) | conformance | 15 | Medium |
| 17 | [Example Pine-port scripts (×3) + integration coverage](./17-example-pine-ports.md) | examples, cli | 16 | Medium |
| 18 | [Phase closeout — docs:generate sweep, version bumps, changeset bundle](./18-phase-closeout.md) | all | 17 | Low |

## Code Reuse

| Existing artefact | Reuse for |
|-------------------|-----------|
| `packages/core/src/statefulPrimitives.ts` `STATEFUL_PRIMITIVES` `ReadonlySet<{ name, slot }>` | Append 8 `state.*` + 1 `request.security` entries (Task 2 + Task 8). Pattern matches Phase-3 `draw.*` additions. |
| `packages/core/src/types.ts` `InputSchema` (`Readonly<Record<string, unknown>>`) | Widen to `Readonly<Record<string, InputDescriptor<unknown>>>` in Task 1; downstream `manifest.inputs` keys carry the typed descriptor. |
| `packages/core/src/types.ts` `IntervalDescriptor` (already shipped in Phase 1 for forward-compat) | Consumed unchanged by `Capabilities.intervals` (Task 6) and `getAvailableIntervals` (Task 13). |
| `packages/core/src/types.ts` `DrawingCounts` | Adapter-kit Task 6 references it for `Capabilities.maxDrawingsPerScript`. No re-declaration. |
| `packages/core/src/define/defineIndicator.ts` existing `DefineIndicatorOpts` | Task 4 extends with the override fields; same file, additive. |
| `packages/compiler/src/program.ts` `CORE_AMBIENT_SHIM` | Tasks 1 / 2 / 3 / 4 / 5 / 7 / 8 each append their new core declarations to the shim — single source of truth keeps in lockstep with `packages/core/src/`. |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Already injects slot ids for every `STATEFUL_PRIMITIVES` entry with `slot: true`. Task 8's `state.*` and `request.security` additions ride this existing transformer — no new pass needed. |
| `packages/compiler/src/analysis/extractInputs.ts` (current stub) | Task 7 replaces the body. |
| `packages/compiler/src/analysis/extractCapabilities.ts` | Task 8 extends with `requestedIntervals` collection — same walker, additive. |
| `packages/runtime/src/stateStore.ts` `StateStore` + `inMemoryStateStore` | Task 9's `state.*` slots persist via the existing store keyed `${slotId}:state` (no new contract). |
| `packages/runtime/src/streamState.ts` head-bar bookkeeping | Task 10's `barstate.*` / `timeframe.*` views derive from `streamState.bar` + `streamState.barIndex()`. |
| `packages/runtime/src/buildComputeContext.ts` | Tasks 9 / 10 / 11 / 12 extend the returned `ComputeContext` with `state`, `barstate`, `syminfo`, `timeframe`, `request`, and the resolved `inputs` bag. Same file, additive. |
| `packages/runtime/src/runtimeContext.ts` `RuntimeContext` | Tasks 9 / 10 / 11 add fields for state slots, views, and request.security stubs. Same file, additive. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` builder set | Task 6 appends `capabilities.intervals(...)`, `capabilities.multiTimeframe(...)`, `capabilities.subPanes(...)`, `capabilities.symInfoFields(...)`, `capabilities.maxDrawingsPerScript(...)` matching the Phase-3 builder shape. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Unchanged — Phase 4 does not add new emission kinds. |
| `packages/conformance/src/runConformanceSuite.ts` `ScenarioAssertion` variants | Task 16 reuses existing `plot-hash` / `drawing-hash` / `alert-count` / `diagnostic-code-present` / `diagnostic-code-absent` / `alert-message-contains`. No new assertion variant. |
| `packages/conformance/src/scenarios/` `inlineSource` pattern (Phase 3) | Task 16's new scenarios use the same pattern — small `defineIndicator` body inlined into the scenario file. |
| `examples/canvas2d-adapter/src/capabilities.ts` `CANVAS2D_CAPABILITIES` | Task 6 extends with Phase-4 triad fields. |
| `packages/cli/src/e2e.test.ts` example-script smoke set | Task 17 appends the three new Pine-port scripts. |
| CLI docs generator (`pnpm chartlang docs`) | Task 18 re-runs unchanged unless the CLI misses new namespace patterns; new core surfaces auto-generate `docs/primitives/{state,barstate,syminfo,timeframe,input,request}/*.md`. |
| `scripts/docs-check.ts` | Re-runs on every PR; Phase 4 keeps the `@example` blocks compileable. |

## Provenance

Phase 4 has **no `../invinite/` math ports** — every new primitive
is a fresh declaration matching PLAN.md §4.5–§4.9 / §12 / §14
spec. The three Pine-port example scripts (Task 17) are translated
from public TradingView Pine documentation idioms (no specific
file SHAs), recorded in each script's header comment.

## Deferred / Follow-Up Work

The following Phase-4-adjacent items are intentionally **NOT** in
scope and land later:

- **HTF time-alignment kernel** (`align-htf-series-to-ltf.ts` port,
  PLAN §6.8) — Phase 5, when adapters flip
  `Capabilities.multiTimeframe: true`.
- **Persistent `StateStore`** (`load` / `save` / `clear` sub-
  interface, IDB backing) — Phase 5. Phase 4 ships only the
  in-memory `state.*` slot store; warm-restart determinism is
  verified end-to-end against the existing in-memory store.
- **`defineAlertCondition`** + `Capabilities.alertConditions`
  wiring — Phase 5. Phase 4 declares
  `Capabilities.alertConditions: boolean` shape, but no
  `signal()` runtime path lands.
- **`runtime.log.*`** + `Capabilities.logs` wiring — Phase 5.
  Phase 4 declares the shape only.
- **`color.fromGradient`** / **`color.withAlpha`** / **`color.rgb`** /
  **`color.hsl`** — Phase 5 (Tier-2 color helpers).
- **`IntervalDescriptor.intervalSeconds?: number`** — Phase 5.
  PLAN §4.9 reserves an optional adapter override for exotic
  intervals (`"3D"`, `"1Q"`). Phase 4 derives `timeframe.inSeconds`
  from `group × numeric prefix(value)` only; widening
  `IntervalDescriptor` lands additively in Phase 5.
- **`request.lowerTf`** — Phase 6 (requires
  `Capabilities.multiTimeframe: true`).
- **`state.array(...)`** / **`state.map(...)`** — beyond 1.0, once a
  collection-serialisation policy is agreed (§4.6 out-of-scope note).
- **Monaco / vanilla DOM editor adapters** — out of scope; the
  language-service is editor-agnostic by construction.
- **Marketplace metadata** — beyond 1.0.

Phase 4 closes when:

1. Every task's `Acceptance Criteria` is checked off.
2. `pnpm -r test` shows 100% coverage on every affected package.
3. `pnpm conformance` is green against the canvas2d reference
   adapter — including the 8 new Phase-4 scenarios.
4. `pnpm docs:check` is green; new `docs/primitives/` pages exist
   for every new core surface.
5. `pnpm readme:check` is green; every package README ≤ 100 lines.
6. Every affected package's `package.json` version is bumped to
   `0.4.x` via the bundled changeset.
7. The three Pine-port example scripts compile end-to-end through
   `packages/cli/src/e2e.test.ts` and render cleanly through the
   canvas2d adapter's `integration.test.ts`.
