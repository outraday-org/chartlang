# Phase 6 — `0.6` Tier-3 Ergonomics + Lower-Timeframe

> **Plan reference:** PLAN.md §19 Phase 6, with cross-cuts into §4.4
> (`@invinite-org/chartlang-core/time` subpath), §4.5
> (`request.lowerTf`), §4.9 (`IntervalDescriptor.intervalSeconds?`),
> §6.8 (multi-stream time alignment — LTF policy), §7.2
> (capabilities), §10.x (session helpers consumer surfaces).
> **Prerequisite:** Phase 5 (`0.5`) shipped — server-side alerts,
> `host-quickjs`, MTF `request.security` with `Capabilities.multiTimeframe: true`,
> `align-htf-series-to-ltf` kernel + cache, 8 new `PlotKind`s,
> `defineAlertCondition` + `runtime.log.*` + `draw.table`,
> color helpers, four volume-profile primitives.
> **Version target:** `0.6` (per-package). `apiVersion: 1` unchanged
> — every Phase 6 addition is additive at runtime.

## Goal

Close the remaining Pine ergonomic gap that Phase 5 left open:
**lower-timeframe arrays** (`request.lowerTf({ interval })` returning
`Series<ReadonlyArray<Bar>>` of contained LTF bars bucketed by main-
bar containment) and **session/timezone helpers** (`session.regular`,
`session.extended`, `session.isOpen`, `weekday`, `nyDayKey`,
`nySessionBounds`, `weekKey`) under the
`@invinite-org/chartlang-core/time` subpath. Ship the
**Pine → chartlang migration guide** so external Pine authors can
port real scripts without reverse-engineering the surface.

Phase 5 enabled MTF in the **HTF direction** (1m main, 1D requested).
Phase 6 enables MTF in the **LTF direction** (1m main, 30s requested,
contained bars exposed as arrays). Both directions share the same
`Capabilities.multiTimeframe: true` flag, the same secondary-stream
event routing, and the same `IntervalDescriptor`-keyed callsite cache.
The only behavioural delta is the alignment policy: **collect all
contained**, not **take most recent**.

## Current State

Phase 5 left the repo at:

- `@invinite-org/chartlang-core` exports `ta.*` (167 primitives
  including 4 volume-profile ports), `plot.*` / `hline` / `alert` /
  `alertcondition`, `draw.*` (62 `DrawingKind`s incl. `"table"`),
  `defineIndicator` / `defineDrawing` / `defineAlert` /
  `defineAlertCondition`, `input.*`, `state.*` / `state.tick.*`,
  `runtime.log.*` / `runtime.error()`, `color.fromGradient` /
  `withAlpha` / `rgb` / `hsl`, `barstate` / `syminfo` / `timeframe`
  views, `request.security({ interval })`. `STATEFUL_PRIMITIVES`
  cardinality is **174**.
- `packages/core/src/types.ts` declares `IntervalDescriptor` as
  `{ readonly value: string; readonly label: string; readonly group: string }`
  — **no `intervalSeconds?: number` field** (PLAN §4.9 reserved this
  for Phase 6). No ordering helpers exist in core.
- `packages/core/package.json` exports `.` only — **no `./time`
  subpath**. No `packages/core/src/time/` directory.
- `packages/core/src/request/request.ts` exports `request.security`
  with `RequestSecurityOpts = { interval: string }` returning
  `SecurityBar`. **No `request.lowerTf`** declaration.
- `packages/runtime/src/request/alignHtfSeriesToLtf.ts` +
  `alignHtfSeriesCache.ts` ship the Phase-5 two-pointer alignment
  kernel (policy: *take most recent HTF value at or before each LTF
  time*). No bucketing kernel for the LTF direction.
- `packages/runtime/src/request/security.ts` wires real HTF-aligned
  secondary streams; emits `multi-timeframe-not-supported` /
  `unsupported-interval` / `unknown-secondary-stream` diagnostics.
- `packages/compiler/src/analysis/` ships
  `extractRequestedIntervals`, `extractMaxLookback`,
  `extractCapabilities`, `extractInputs`,
  `extractAlertConditions`, `forbiddenConstructs`,
  `statefulCallInLoop`. No `validateLowerTfIntervals` pass.
- `packages/adapter-kit/src/types.ts` `DiagnosticCode` union covers
  the Phase-5 set. **No `"lower-tf-not-lower"`** code.
- `examples/canvas2d-adapter/src/capabilities.ts`
  `CANVAS2D_CAPABILITIES.multiTimeframe: true` (Phase 5 flip). The
  declared `intervals` set supports `"1m"`, `"5m"`, `"15m"`, `"1H"`,
  `"4H"`, `"1D"` — no sub-minute intervals yet.
- `packages/conformance/src/scenarios/` covers MTF (HTF direction)
  scenarios (`mtfRequestSecurityClose`, `unsupportedInterval`,
  `mtfCapabilityFalse`, `requestSecurityNanFallback`). No LTF
  scenarios.
- `docs/spec/` ships `emissions.md`, `grammar.md`, `manifest.md`,
  `semantics.md`, `versioning.md`. **No Pine migration guide.**

## Target State

After Phase 6 closes:

- **`IntervalDescriptor.intervalSeconds?: number`** ships in
  `packages/core/src/types.ts` per PLAN §4.9. A pure helper
  `intervalToSeconds(d: IntervalDescriptor): number` prefers the
  optional field, otherwise parses `d.value` against the standard
  prefix grammar (`"30s"`, `"5"` → `5m`, `"5m"`, `"4H"`, `"1D"`,
  `"1W"`, `"1M"`, `"3M"`). NaN-tolerant for unknown prefixes; throws
  on negative / zero / empty. Exported from
  `@invinite-org/chartlang-core`.
- **`@invinite-org/chartlang-core/time`** subpath ships from
  `packages/core/src/time/` with:
  - `session.regular(tz: string, t: Time): SessionBounds | null`
  - `session.extended(tz: string, t: Time): SessionBounds | null`
  - `session.isOpen(tz: string, t: Time, type: SessionType): boolean`
  - `weekday(tz: string, t: Time): Weekday` (`0` = Sunday … `6` =
    Saturday)
  - `nyDayKey(t: Time): string` (`"YYYY-MM-DD"` in NY tz, DST-safe)
  - `nySessionBounds(t: Time): SessionBounds` (regular 09:30–16:00 NY)
  - `weekKey(tz: string, t: Time): string` (ISO-week `"GGGG-Www"`)
  - All functions pure over `Time` (no implicit global TZ — `tz` is
    always explicit). Ported from `../invinite/src/components/
    trading-chart/indicators/lib/ny-day-key.ts` +
    `session-boundaries.ts` with the standard 4-line provenance
    header.
- **`request.lowerTf({ interval })`** ships from
  `@invinite-org/chartlang-core/request`. Returns
  `Series<ReadonlyArray<Bar>>` of contained lower-TF bars per main
  bar. Compile-time check: lower-tf seconds < main-tf seconds via
  `intervalToSeconds`. Capability-gated by
  `Capabilities.multiTimeframe: true` (same flag as `request.security`
  — no separate capability).
- **`validateLowerTfIntervals`** compiler pass walks every
  `request.lowerTf({ interval })` callsite, resolves the literal /
  `input.enum` value against the declared main interval (from
  `manifest.userPickableInterval` if known, else the analysis runs
  against every declared interval from `manifest.requestedIntervals`
  + `Capabilities.intervals`), and emits **`lower-tf-not-lower`** at
  compile time when the lower interval is ≥ the main interval.
  `"lower-tf-not-lower"` joins the `DiagnosticCode` union.
- **Runtime: `lower-tf bucketing`**. A new pure kernel
  `bucketLtfBarsByMainContainment` ships in
  `packages/runtime/src/request/` alongside the Phase-5 HTF kernel.
  Two-pointer walk over the LTF bar stream: for each main bar, the
  output `ReadonlyArray<Bar>` enumerates LTF bars whose `time` falls
  within `[mainBar.time, nextMainBar.time)`. In-progress LTF bars
  (whose `time` falls inside the current main-bar window but whose
  next LTF bar has not arrived) are included via a `pending` half-
  bucket consistent with the Phase-5 *expose in-progress HTF bar*
  semantics. Cached identically to the HTF kernel via
  `WeakMap<mainBars, WeakMap<ltfBars, ReadonlyArray<ReadonlyArray<Bar>>>>`.
- **Runtime wiring.** `request/security.ts` (or a sibling
  `request/lowerTf.ts`) routes `request.lowerTf` callsites through
  the bucketing kernel. Secondary stream registration is the same
  path as HTF — adapter delivers stream identically to
  `request.security`. Diagnostics: `multi-timeframe-not-supported`
  when capability disabled, `unsupported-interval` when the lower-tf
  interval is not in `Capabilities.intervals`,
  `unknown-secondary-stream` when stream registration fails. Three
  conformance scenarios land.
- **`canvas2d-adapter`** stays on `multiTimeframe: true`; its declared
  `intervals` set grows to include `"30s"` + `"15s"` so the LTF
  conformance scenarios can run against the reference adapter. No
  rendering change — `request.lowerTf` results stay in the runtime
  (no new emission shape).
- **`docs/spec/pine-migration.md`** ships a curated migration guide:
  six worked examples (indicators, drawings, alerts, inputs, state,
  multi-timeframe — both HTF + LTF), a Pine→chartlang feature
  matrix flagging gaps (strategy primitives, webhooks, advanced
  `plot()` options), and an explicit 5-script audit checklist
  proving the guide covers real Pine code. PR-gated by
  `pnpm docs:check`.
- **Docs / READMEs.** Auto-generated `docs/primitives/request/lowerTf.md`,
  `docs/primitives/time/session-helpers.md`, etc. Every new public
  surface carries `@since 0.6` JSDoc with `@example` that compiles +
  a stability marker. `pnpm docs:check` / `pnpm readme:check` stay
  green.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **LTF reuses `Capabilities.multiTimeframe: true`, no new capability** | The capability surface declares *the adapter can deliver secondary streams*; the direction (HTF / LTF) is a script concern, not an adapter capability. Phase 5 already shipped the flip; reusing it avoids a new gate that adapters would have to opt into individually. The PLAN §4.5 wording confirms this. |
| **Risk-first task order: foundational core types → time subpath → kernel → core surface + compiler → runtime → docs → closeout** | The `intervalSeconds?` + `intervalToSeconds` helper unblocks every downstream LTF ordering check. Time subpath (session helpers) is independent and lands second so it can ship even if LTF is delayed. The bucketing kernel is pure math and lands third; the core surface + compiler pass land fourth; the runtime wiring + conformance + canvas2d flip land fifth. Migration guide is independent docs work. Closeout last. |
| **`intervalSeconds?` is an *optional* override, not required** | PLAN §4.9 reserved this for exotic intervals (e.g. tick-based, range-based). The standard prefix grammar (`30s`, `1`, `5m`, `4H`, `1D`, `1W`, `1M`, `3M`) covers every Pine interval and is parsed at runtime. Adapter authors only set `intervalSeconds` when an interval falls outside the grammar. |
| **LTF bucketing kernel lives in `packages/runtime/src/request/` alongside the HTF kernel, not in a shared `request/lib/`** | Both kernels are pure two-pointer walks over `(mainBars, secondaryBars)`. Co-locating them keeps the "alignment policy" decisions in one place and lets future kernels (e.g. resample, tick-bucket) join the same folder. No premature `_lib/` abstraction. |
| **In-progress LTF bar is included in the current main-bar bucket** | Phase 5's HTF kernel exposes the in-progress HTF bar (per the alignment kernel comments). LTF symmetry: bars whose `time` falls inside the current main-bar window but whose successor has not arrived stay in the current bucket. The runtime distinguishes pending from closed via the same `streamState.bar` identity it uses for the main stream — no new field. |
| **Compile-time `lower-tf-not-lower` diagnostic, not runtime** | The interval ordering is statically derivable from the literal `interval` argument + the declared main interval. Catching it at compile time is strictly better: surfaces in the editor, blocks invalid scripts before they consume runtime budget, no diagnostic dedup overhead. Mirrors `request-security-interval-not-literal`. Lives in `CompileDiagnosticCode` (compiler), **not** the adapter-kit runtime `DiagnosticCode` union. |
| **`validateLowerTfIntervals` is a fresh analysis pass, not a fold into `extractRequestedIntervals`** | The existing pass collects intervals into `manifest.requestedIntervals`; the new pass validates *ordering relationships* between intervals. Different concerns (collection vs validation), different diagnostic codes. Co-locating would tangle two ASTs. |
| **Session helpers ship `tz: string` explicitly — no module-level default** | PLAN §4.4 + the README note both call this out. Implicit global TZ would couple every session call to the host's `Intl.DateTimeFormat` default; explicit `tz` makes scripts deterministic across timezones and easier to test. The session helpers wrap `Intl.DateTimeFormat({ timeZone: tz })` with a small cache. |
| **Session helpers carry the standard 4-line invinite provenance header** | Mirrors every other port. The two source files (`ny-day-key.ts` + `session-boundaries.ts`) translate cleanly to the chartlang shape (`tz` parameter, `Time` instead of `number`, JSDoc with `@since 0.6`). |
| **Pine migration guide is its own task with a 5-script audit checklist** | The guide is a curated doc, not auto-generated. The audit checklist (verify the guide covers 5 representative real Pine scripts) is the acceptance criterion that prevents the guide from drifting into ornamental coverage. |
| **No new `STATEFUL_PRIMITIVES` entries this phase** | `request.lowerTf` is a pure function over the secondary stream cache (like `request.security` — Phase 5 added no STATEFUL entry for it). Session helpers are pure. Cardinality stays at **174**. |
| **`canvas2d-adapter` adds `"30s"` + `"15s"` to its declared `intervals`** | Conformance scenarios need sub-minute intervals to exercise the LTF kernel. The adapter doesn't actually render sub-minute candles in the bundled demo — the declared support is for the runtime path. Adapters that don't support sub-minute intervals omit them from their capability declaration. |

## Dependency Graph

```
1 core-interval-descriptor-seconds
  |
  v
2 core-time-subpath-and-session-helpers
  |
  v
3 runtime-bucket-ltf-kernel-port
  |
  v
4 core-request-lower-tf-and-compiler-validation
  |
  v
5 runtime-request-lower-tf-and-canvas2d
  |
  v
6 docs-pine-migration-guide
  |
  v
7 phase-closeout
```

Execution is strictly sequential. Each task's prerequisites are
satisfied by all lower-numbered tasks.

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|------------|--------------|-----------------|
| 1 | [Core: `IntervalDescriptor.intervalSeconds?` + `intervalToSeconds` helper](./1-core-interval-descriptor-seconds.md) | core | None | Low |
| 2 | [Core: `time` subpath + session helpers port](./2-core-time-subpath-and-session-helpers.md) | core | 1 | Medium |
| 3 | [Runtime: `bucketLtfBarsByMainContainment` kernel + cache](./3-runtime-bucket-ltf-kernel-port.md) | runtime | 2 | Medium |
| 4 | [Core: `request.lowerTf` surface + compiler `validateLowerTfIntervals` pass](./4-core-request-lower-tf-and-compiler-validation.md) | core, compiler, adapter-kit | 3 | High |
| 5 | [Runtime: `request.lowerTf` wiring + canvas2d intervals + conformance](./5-runtime-request-lower-tf-and-canvas2d.md) | runtime, examples/canvas2d-adapter, conformance | 4 | High |
| 6 | [Docs: Pine → chartlang migration guide](./6-docs-pine-migration-guide.md) | docs | 5 | Medium |
| 7 | [Phase closeout — docs sweep, version bumps, changeset bundle](./7-phase-closeout.md) | all | 6 | Low |

## Code Reuse

| Existing artefact | Reuse for |
|-------------------|-----------|
| `packages/core/src/types.ts` `IntervalDescriptor` | Task 1 widens with optional `intervalSeconds?: number`. Additive — no Phase-5 consumer breaks. |
| `packages/core/src/types.ts` `Time` (branded `number`) | Tasks 2 / 3 / 4 reuse the existing brand. No new time type. |
| `packages/core/src/types.ts` `Bar` | Task 3's bucketing kernel returns `ReadonlyArray<ReadonlyArray<Bar>>` of the existing `Bar`. No new bar shape. |
| `packages/core/src/types.ts` `Series<T>` | Task 4's `request.lowerTf` returns `Series<ReadonlyArray<Bar>>` via the same `Series` Proxy mechanism the rest of core uses. |
| `packages/core/src/request/request.ts` `RequestSecurityOpts` shape | Task 4 mirrors it for `RequestLowerTfOpts = { interval: string }`. Same literal-only opts contract. |
| `packages/core/src/request/request.ts` `SecurityBar` view shape | Task 4 reuses the underlying `Bar` view machinery — `request.lowerTf` bars are plain `Bar`s, not a derived view, but the runtime path mirrors the Phase-5 cache + dedup structure. |
| `packages/core/package.json` `exports` block | Tasks 2 / 4 add new subpath entries (`"./time"`) and re-export `request.lowerTf` from the existing `.` entry. |
| `packages/runtime/src/request/alignHtfSeriesToLtf.ts` two-pointer walk | Task 3's bucketing kernel mirrors the two-pointer pattern but the inner loop *collects* bars rather than *selecting* the most recent. Same complexity, same JSDoc style. |
| `packages/runtime/src/request/alignHtfSeriesCache.ts` `WeakMap` cache | Task 3's bucketing cache reuses the WeakMap-of-WeakMap pattern (mainBars → ltfBars → ReadonlyArray<ReadonlyArray<Bar>>). No new cache primitive. |
| `packages/runtime/src/request/security.ts` `pushOnce` diagnostic dedup | Task 5 reuses this for `multi-timeframe-not-supported` / `unsupported-interval` per LTF callsite. Same dedup key shape. |
| `packages/runtime/src/streamState.ts` `StreamState` + `secondaryStreams` map | Task 5 routes LTF events through the existing secondary-stream machinery. No new stream type — LTF is just a secondary stream whose `interval` happens to be smaller than the main interval. |
| `packages/runtime/src/createScriptRunner.ts` `CandleEvent.streamKey` discriminant | Task 5 reuses the existing event-routing pattern. Adapter delivers LTF candles with `streamKey = "<interval>"` identical to HTF candles. |
| `packages/compiler/src/diagnostics.ts` `CompileDiagnosticCode` union | Task 4 appends `"lower-tf-not-lower"` at the end of the union (Phase-1 "new codes added at the end" contract). Additive — adapter-kit's runtime `DiagnosticCode` union is untouched. |
| `packages/adapter-kit/src/types.ts` `Capabilities.multiTimeframe` | Task 5 reuses the existing flag. No new capability key. |
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` AST walker | Task 4's `validateLowerTfIntervals` mirrors the same node-visiting pattern — different validation focus. |
| `packages/compiler/src/diagnostics/createDiagnostic.ts` factory | Task 4's pass uses this for `lower-tf-not-lower` emission. Same factory. |
| `packages/compiler/src/program.ts` `CORE_AMBIENT_SHIM` | Tasks 1 / 2 / 4 each append their new core declarations to the shim. |
| `packages/conformance/src/runConformanceSuite.ts` assertion variants | Task 5 reuses `plot-hash` / `diagnostic-code-present` / `diagnostic-code-absent`. No new assertion variants needed. |
| `examples/canvas2d-adapter/src/capabilities.ts` `CANVAS2D_CAPABILITIES` | Task 5 widens the `intervals` set with sub-minute entries (`"30s"`, `"15s"`). No new capability field. |
| `scripts/docs-check.ts` + `scripts/gen-docs.ts` | Every new public surface auto-generates a `docs/primitives/...` page. The Pine migration guide is a hand-curated page added to the explicit doc registry. |
| Existing `*.bench.test.ts` pairs in `packages/runtime/src/request/` | Task 3 follows the Phase-5 bench-pair pattern: `bucketLtfBars.bench.ts` (vitest bench mode) + `bucketLtfBars.bench.test.ts` (`THRESHOLD_MS` assertion). |

## Provenance

Phase 6 carries the following ports from
`../invinite/src/components/trading-chart/`:

| chartlang file | Invinite source | Commit SHA | Task |
|----------------|-----------------|------------|------|
| `packages/core/src/time/nyDayKey.ts` | `indicators/lib/ny-day-key.ts` | `fb882a97e018ea0cc9a451fb7d839dc8d894c08b` | 2 |
| `packages/core/src/time/sessionBoundaries.ts` | `indicators/lib/session-boundaries.ts` | `fb882a97e018ea0cc9a451fb7d839dc8d894c08b` | 2 |

Every port carries the standard workspace provenance header (per
CONTRIBUTING.md §3.1 and the Phase-2+ pattern in
`packages/runtime/src/ta/sma.ts`):

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/<file>.ts
//   (commit <sha at port time>, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

The LTF bucketing kernel (Task 3) is **net-new** code (no invinite
parallel) and carries no provenance header — it ships with the
standard chartlang copyright header only.

## Deferred / Follow-Up Work

The following Phase-6-adjacent items are intentionally **NOT** in
scope and land in Phase 7 or beyond:

- **Tick-/range-based intervals** — Phase 7+. The `intervalSeconds?`
  override (Task 1) is the hook; no Phase-6 adapter declares such an
  interval.
- **Session-aware indicators** (e.g. `ta.sessionVwap`, anchored-to-
  session resets) — Phase 7. The session helpers (Task 2) are the
  foundation; consumer indicators land later.
- **Editor surfaces for `request.lowerTf`** (e.g. autocomplete on
  lower-than-main intervals) — beyond 1.0. The language-service
  already handles `request.security` autocomplete; the LTF variant
  reuses the same path with no editor change in Phase 6.
- **`request.security({ symbol })` cross-symbol** — Phase 7. Phase 5
  + 6 are interval-only; cross-symbol streaming requires a new
  capability axis (`crossSymbol: boolean`).
- **Pine `request.financial` / `request.dividends` / `request.economic`**
  — out of OSS scope. PLAN §15 marks these as consumer-repo concerns.
- **Strategy primitives** (`strategy.entry`, `strategy.close`,
  `strategy.exit`) — beyond 1.0. The migration guide (Task 6) flags
  these as "not supported, see roadmap".
- **Webhook alert delivery** — out of OSS scope. The migration guide
  documents `defineAlertCondition` + `alert()` only; webhook
  delivery is consumer-adapter concern.
- **DOM-rendered editor / Monaco adapter** — out of scope. The
  language-service stays editor-agnostic.

Phase 7 ready: see [`tasks/phase-7-standardisation/`](../phase-7-standardisation/).

Phase 6 closes when:

- [ ] Every task's `Acceptance Criteria` is checked off.
- [ ] `pnpm -r test` shows 100% coverage on every affected package.
- [ ] `pnpm conformance` is green against the canvas2d reference
      adapter — including the three new LTF scenarios.
- [ ] `pnpm docs:check` is green; new `docs/primitives/` pages exist
      for `request.lowerTf` and every session helper. The Pine
      migration guide (`docs/spec/pine-migration.md`) is registered
      in the explicit doc list and validates.
- [ ] `pnpm readme:check` is green; every package README ≤ 100 lines.
- [ ] Every affected package's `package.json` version is bumped to
      `0.6.x` via the bundled changeset.
- [ ] `request.lowerTf` round-trips through conformance with bucketed
      lower-tf bars matching invinite's behaviour.
- [ ] `lower-tf-not-lower` diagnostic fires at compile time for
      invalid combinations; the editor surfaces the diagnostic.
- [ ] Session helpers match invinite golden outputs for NY trading
      hours, including DST transitions.
- [ ] Pine migration guide reviewed against at least 5 real Pine
      scripts — every idiom either has a documented equivalent or
      an explicit "not supported, see roadmap" note.
