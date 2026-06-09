# Phase 5 — `0.5` Server-side Alerts + Tier-2 Ergonomics

> **Plan reference:** PLAN.md §19 Phase 5, with cross-cuts into §6.1
> (`StateStore` contract), §6.8 (multi-stream time alignment), §6.9
> (state persistence), §7.2 (capabilities + new `PlotKind`s), §7.3
> (emission wire schemas), §8.3 (`host-quickjs`), §9.2 (volume-profile
> primitives), §10.1.1 (anchored indicators), §10.2 (`draw.table`),
> §11.2 (`defineAlertCondition`), §11.3 (`runtime.log.*` /
> `runtime.error()`), §11.4 (color helpers), §22.10 (per-port landing
> rule).
> **Prerequisite:** Phase 4 editor + Tier-1 (`0.4`) shipped — see
> `tasks/phase-4-editor-tier1/README.md`.
> **Version target:** `0.5` (per-package). `apiVersion: 1` script
> header unchanged — every Phase 5 addition is additive at runtime.

## Goal

Lift `chartlang` from a browser-only Phase-4 surface to a **server-
gradeable runtime**: scripts execute under a hard-isolated QuickJS-WASM
host with memory + CPU caps, snapshots persist across mounts so cold
warmup compute disappears (~500× drop on alert-eval cron workloads),
and `request.security` finally streams real higher-timeframe data via
the §6.8 HTF→LTF alignment kernel. Adapters flip
`Capabilities.multiTimeframe: true`, and the conformance suite's warm-
start determinism test pins byte-identical emissions across cold and
warm runs.

On top of that foundation, ship the **Tier-2 ergonomics** that turn
real Pine ports into idiomatic chartlang:
`defineAlertCondition` (user-wired named conditions), `runtime.log.*`
+ `runtime.error()` (editor log pane + scriptable halt), `draw.table`
(viewport-anchored dashboards), the 8 missing `PlotKind`s (`shape` /
`character` / `arrow` / `candle-override` / `bar-override` / `bg-color`
/ `bar-color` / `horizontal-histogram`), the four volume-profile
primitives that consume `horizontal-histogram`, and the dynamic color
helpers (`color.fromGradient` / `color.withAlpha` / `color.rgb` /
`color.hsl`).

## Current State

Phase 4 left the repo at:

- `@invinite-org/chartlang-core` exports `ta.*` (Phase-2 inventory),
  `plot.*` / `hline` / `alert` (immediate-fire), `draw.*` (61 Phase-3
  `DrawingKind`s), `defineIndicator` / `defineDrawing` / `defineAlert`,
  `input.*`, `state.*` / `state.tick.*`, `barstate` / `syminfo` /
  `timeframe` views, `request.security({ interval })` typed namespace.
  `STATEFUL_PRIMITIVES` cardinality is **163**. `PlotKind` is a 9-entry
  union (`"line" | "step-line" | "horizontal-line" | "histogram" |
  "bars" | "area" | "filled-band" | "label" | "marker"`).
- `packages/core/src/types.ts` declares `Bar`, `Series<T>`, `Color`,
  `LineStyle`, `PlotLineStyle`, `AlertSeverity`, `IntervalDescriptor`,
  `InputSchema` (typed Phase 4), `CapabilityId`, `DrawingCounts`,
  `ScriptManifest` (with `inputs`, `userPickableInterval`,
  `requestedIntervals`, `maxDrawings?`), `ComputeContext`,
  `CompiledScriptObject`, `JsonValue`. No `StateSnapshot` /
  `StreamSnapshot` / `StateStoreKey` types yet — Phase 4 left §6.9
  as a forward-compat note in `packages/runtime/src/stateStore.ts`.
- `packages/adapter-kit/src/types.ts` exports `Capabilities` with all
  13 fields declared (Phase-4 closeout): `plots`, `drawings`, `alerts`,
  `alertConditions: boolean`, `logs: boolean`, `inputs`, `intervals`,
  `multiTimeframe: boolean`, `subPanes`, `symInfoFields`,
  `maxDrawingsPerScript`, `maxLookback`, `maxTickHz`. Phase 4 declared
  the boolean *shape*; Phase 5 wires the *runtime semantics*.
  `PlotEmission.style` is a 7-variant discriminated union matching the
  9 Phase-4 `PlotKind`s (no `horizontal-histogram` / `shape` /
  `character` / `arrow` / `candle-override` / `bar-override` /
  `bg-color` / `bar-color`). `AlertEmission` exists; no
  `AlertConditionEmission` or `LogEmission`. `RunnerEmissions` carries
  `plots / drawings / alerts / diagnostics` only.
- `packages/compiler/src/analysis/` ships `extractCapabilities`,
  `extractInputs`, `requestSecurityLiteralPass`. No
  `extractAlertConditions` pass yet.
- `packages/runtime/src/stateStore.ts` exports the Phase-1 slot
  `StateStore` (`get` / `set` / `has` / `clear`) + `inMemoryStateStore()`.
  No `PersistentStateStore` sub-interface (the file's JSDoc names it
  as a forward-compat hook). `packages/runtime/src/state/` carries the
  Phase-4 `state.*` slot store + committed/tentative semantics.
- `packages/runtime/src/request/` runs `request.security` as a NaN-
  secondary-bar stub; `multi-timeframe-not-supported` diagnostic fires
  for every callsite. No alignment kernel.
- `packages/runtime/src/streamState.ts` owns the main-stream `Bar` /
  `Series<T>` population. Secondary streams not wired.
- `packages/host-worker/src/` ships the full Phase-1 wire protocol
  (`HostToWorker` / `WorkerToHost`), `createWorkerHost`,
  `filterEmissions`, sandbox tests, bench. No IDB persistence.
- `packages/host-quickjs/src/` is a **stub** — `index.ts` (lines: a
  PACKAGE_VERSION export only). No QuickJS runtime, no protocol mirror.
- `packages/conformance/src/scenarios/` covers Phase-2 + Phase-3 +
  Phase-4 surfaces. No volume-profile, alert-condition, log, or
  table scenarios.
- `examples/canvas2d-adapter/src/` declares Phase-4 capabilities
  (`alertConditions: false`, `logs: false`, `multiTimeframe: false`).
  Renders Phase-2 plots + Phase-3 drawings + Phase-4 views.

## Target State

After Phase 5 closes:

- **Persistence.** `@invinite-org/chartlang-core` exports the
  `StateSnapshot` / `StreamSnapshot` / `StateStoreKey` types per §6.1
  + §6.9 (JsonValue-clean, `snapshotVersion: 1`). The runtime exports
  a `PersistentStateStore` sub-interface (`load` / `save` / `clear` +
  `readonly key: StateStoreKey`) sitting **beside** the existing slot
  `StateStore`, plus an `inMemoryPersistentStateStore({ key })`
  factory for tests + conformance. Snapshot restore + gap-replay
  ships per §6.9; the conformance suite's warm-start determinism test
  asserts byte-identical emissions past the snapshot point.
- **Browser persistence.** `@invinite-org/chartlang-host-worker/idb`
  subpath ships `idbStateStore({ dbName, capBytes? })` — one IDB
  record per `StateStoreKey`, default 50 MB cap, oldest-first
  eviction, dispose + 60s-cadence writes.
- **MTF (multi-timeframe).** `packages/runtime/src/request/` ports
  `align-htf-series-to-ltf` + `align-htf-series-cache` from
  `../invinite/`, runs `request.security` as a real HTF-aligned
  secondary bar, and the canvas2d-adapter flips
  `Capabilities.multiTimeframe: true`. The conformance suite covers
  three MTF scripts.
- **`host-quickjs`.** `@invinite-org/chartlang-host-quickjs` ships
  `createQuickJsHost(opts)` matching the `host-worker` `ScriptHost`
  shape **byte-for-byte** on the wire. Built on `quickjs-emscripten`
  with `setMaxMemory(64 * 1024 * 1024)` and `setInterruptHandler`
  CPU cap (~1 ms per `compute` step). Sandbox-escape suite covers
  `Function` / `globalThis` / `eval` / `import()` / cross-realm
  access. Bench runs against `host-worker` and lands a `roundTrip`
  measurement (target ≤100× slower per §8.3).
- **`STATEFUL_PRIMITIVES`** cardinality grows from **163** →
  **171**: 163 carried over + 1 `defineAlertCondition.signal` +
  1 `runtime.log` (the `log.*` methods share a single set entry,
  `slot: false`) + 1 `runtime.error` + 1 `draw.table` + 4 volume-
  profile primitives. Test asserts `.size === 171`.
- **`PlotKind`** widens from 9 → 17: adds `shape`, `character`,
  `arrow`, `candle-override`, `bar-override`, `bg-color`,
  `bar-color`, `horizontal-histogram`. `PlotEmission.style` widens
  to match. `capabilities.plots(...)` covers all 17.
- **`DrawingKind`** widens from 61 → 62 (`"table"`). `TableCell` ships
  from `@invinite-org/chartlang-core`. `KIND_BUCKET` maps `"table"` to
  the `"other"` bucket. The canvas2d-adapter renders viewport-anchored
  tables.
- **`defineAlertCondition`** ships in core; the compiler extracts
  `manifest.alertConditions: ReadonlyArray<string>`; the runtime emits
  `AlertConditionEmission`; `Capabilities.alertConditions: false`
  gates `signal()` to a silent no-op with
  `alert-conditions-not-supported` diagnostic. canvas2d-adapter
  flips `alertConditions: true` and lists conditions in its sample
  UI surface.
- **`runtime.log.*`** + **`runtime.error()`** ship; `LogEmission`
  joins `RunnerEmissions.logs`. 1000-log-per-step cap with
  `runtime-log-budget-exceeded` diagnostic. `runtime.error(msg)`
  halts the bar's compute, emits a fatal `RuntimeDiagnostic`, and
  surfaces a red banner via the language-service. canvas2d-adapter
  flips `logs: true`.
- **`color.fromGradient` / `color.withAlpha` / `color.rgb` /
  `color.hsl`** ship from `@invinite-org/chartlang-core` — pure
  functions returning CSS-string `Color` values, alpha clamped to
  `[0, 1]`, NaN-tolerant.
- **Volume-profile primitives.** Four primitives port from
  `../invinite/`: `ta.visibleRangeVolumeProfile` (209 LOC source),
  `ta.anchoredVolumeProfile` (317), `ta.sessionVolumeProfile` (385),
  `ta.fixedRangeVolumeProfile` (363). Shared math
  (`bucket-edges` / `bucketize-volume` / `value-area` / `intercept` /
  `too-heavy` / `developing-series` / `volume-profile-shared`)
  ports first into `packages/runtime/src/ta/lib/volume-profile/`
  (alongside the existing Phase-2 helpers in `lib/`).
  All four indicators emit `PlotKind = "horizontal-histogram"`.
- **Docs / READMEs** regenerate; `pnpm docs:check` /
  `pnpm readme:check` stay green. Every new public surface carries
  `@since 0.5` JSDoc with `@example` that compiles + a stability marker.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Risk-first task order: persistence → MTF → host-quickjs → Tier-2 ergonomics → volume-profile** | The highest-blast-radius work lands first so it surfaces issues while the long tail (PlotKinds / draw.table / color helpers / VPs) is still movable. Persistence and MTF both edit `RuntimeContext`; landing them serially keeps the merge surface clean. Host-quickjs depends on neither, but slots after MTF so its sandbox-escape suite can pin the post-MTF wire shape. Confirmed via `AskUserQuestion`. |
| **`PersistentStateStore` is a sibling sub-interface, not a widening of `StateStore`** | The Phase-1 `StateStore.{get,set,has,clear}` is the per-bar primitive slot bag — its CLAUDE.md invariants (e.g. *"state.* snapshots are host-owned once flushed"*) lean on this shape. The §6.9 `load` / `save` / `clear` contract is a cross-mount snapshot store keyed by `StateStoreKey`. Different concerns, different methods, different lifecycle. The runtime accepts both — a slot store **and** an optional persistent store — and the Phase-4 invariants stay intact. Confirmed via `AskUserQuestion`. |
| **`idbStateStore` lives in `@invinite-org/chartlang-host-worker/idb`, not core** | The IDB API is browser-only; pulling it into `runtime` would force every server-side host to deal with a phantom dependency. `host-worker` is the browser-default host and already declares browser-only invariants in its CLAUDE.md — IDB belongs there. Server hosts (`host-quickjs`) accept caller-supplied `PersistentStateStore` instances per §6.9; the OSS repo ships **no** server backing. |
| **MTF flip is part of Phase 5, not deferred** | The Phase 5 README's done-criteria says *"All `Capabilities.multiTimeframe: true` paths covered by conformance; HTF→LTF alignment matches invinite's reference outputs."* The kernel port + canvas2d flip + MTF conformance scenarios ship in the same phase. Splitting them would leave Phase 5 with a non-functional `request.security`. Confirmed via `AskUserQuestion`. |
| **All 8 new `PlotKind`s land in one bundled task** | Each new kind is a small (~30–50 LOC) addition to `core/PlotKind`, `adapter-kit/PlotStyle`, runtime emit dispatch, and canvas2d renderer. Bundling avoids 8 tiny tasks with near-identical scaffolding. Mirrors Phase-2 Task X-1 plotkind-expansion. Spec target ~300 lines. Confirmed via `AskUserQuestion`. |
| **Volume-profile shared lib is its own task; each VP indicator is its own task** | The four VP indicators (1,274 LOC of invinite source combined) share substantial math (bucket edges, value-area, intercept). Porting the shared lib first means each indicator task is a clean §22.10 set against a stable helper surface. Pattern mirrors Phase 2's `lib/*` helpers-first split. Confirmed via `AskUserQuestion`. |
| **`host-quickjs` ships as three sequential tasks: scaffold + impl + sandbox/bench** | The §22.4 template requires `pnpm scaffold` as its own beat. The membrane (JsonValue marshalling, interrupt handler, message dispatch) is non-trivial — bundling it with sandbox-escape tests would push spec line count past ~500. The sandbox-escape suite is a defence-in-depth concern that warrants its own review focus. Confirmed via `AskUserQuestion`. |
| **`defineAlertCondition` + `runtime.log.*` + `draw.table` are three separate tasks** | Each capability is end-to-end (core + compiler + runtime emission + capability gating + canvas2d + conformance). Bundling any two would push spec line counts past ~400 and conflate review surfaces. Sequential tasks let each capability ship a clean changeset and conformance scenario. |
| **Color helpers ship as a single task; pure-core, no runtime coupling** | The four helpers (`fromGradient` / `withAlpha` / `rgb` / `hsl`) are pure functions on `Color` (`string`). Bundling matches Phase-2 Color/style additions. ~220-line spec. Confirmed via `AskUserQuestion`. |
| **Capabilities builders: only add Phase-5 surfaces, never re-edit Phase-4 builders** | Phase 4 already shipped `capabilities.intervals(...)` / `multiTimeframe(...)` / `subPanes(...)` / `symInfoFields(...)` / `maxDrawingsPerScript(...)`. Phase 5 adds **only** `capabilities.alertConditions(...)` and `capabilities.logs(...)`, and widens the existing `capabilities.plots(...)` / `capabilities.drawings(...)` sets with new kinds. No churn on Phase-4 builders. Confirmed via `AskUserQuestion`. |
| **`AlertConditionEmission` / `LogEmission` are new top-level fields on `RunnerEmissions`, not folded into `alerts` / `diagnostics`** | PLAN §11.2 names `AlertConditionEmission` (not `AlertEmission`-shaped) and §7.3 lists `RunnerEmissions.logs` as a Phase-5 addition. Folding alert-conditions into `alerts` would force the adapter to discriminate at consume time; folding logs into diagnostics would muddle the `RuntimeDiagnostic` semantics. Keeping the channels separate matches Pine's mental model (`alertcondition` vs `alert` vs `runtime.log`). |
| **`draw.table` positions absolutely in CSS-pixel viewport, not world-space** | Per PLAN §10.2: *"`table` drawings position absolutely in the chart's CSS-pixel viewport (NOT in world space)"*. No `WorldPoint` anchor; emission carries a `position` enum (`"top-left"` / … / `"bottom-right"`). Bucket: `"other"` (separate from the world-space line/box/etc. buckets). |
| **`runtime.error(msg)` halts compute for the current bar, not the whole script** | Pine semantics: `runtime.error()` aborts the current bar's compute path but the script remains mounted; subsequent bars run normally. Implementation throws a sentinel inside the runtime's `try/catch` around `compute(ctx)`, the runtime emits a fatal `RuntimeDiagnostic`, and the bar's partial emissions are dropped. Test posture: a `runtime.error()` followed by a `plot()` on the same bar must produce no `PlotEmission`. |
| **`runtime.log.*` is capability-gated to a silent no-op (no diagnostic) when `Capabilities.logs: false`** | Per PLAN §11.3: logs are *debugging*, not signal. A diagnostic on every disabled log would flood the diagnostic channel for any script that uses `runtime.log.info` in a hot path. The 1000-log-per-step cap still fires as a `runtime-log-budget-exceeded` diagnostic — that's a script bug, not a capability mismatch. |
| **`STATEFUL_PRIMITIVES` adds 8 new entries: `defineAlertCondition.signal`, `runtime.log`, `runtime.error`, `draw.table`, 4 VP primitives** | `signal`, `log`, and `error` are stateless (no `slot`), but listed so the in-loop diagnostic walker can detect them. `draw.table` needs a stable handle id so updates work — `slot: true`. The 4 VP primitives are stateful ring-buffer consumers — `slot: true`. Final cardinality 171. |
| **`PlotKind = "horizontal-histogram"` lands in Task 9 (PlotKind expansion), not in the VP tasks** | The four VP primitives all emit `horizontal-histogram`, but the kind itself is shared infrastructure that the canvas2d renderer + emission validator need before any VP indicator can ship. Task 9 lands the kind; Tasks 15–18 consume it. |
| **`align-htf-series-to-ltf` port carries the standard 4-line invinite provenance header** | Mirrors every Phase-2 / Phase-3 port. The kernel is 49 LOC of pure two-pointer math; the cache layer is 126 LOC with a `WeakMap` keyed by `(htf, ltf)` pair. Both files ship their existing `.test.ts` adapted to the chartlang test infrastructure. |

## Dependency Graph

```
1 core-state-snapshot-types
  |
  v
2 runtime-persistent-state-store
  |
  v
3 host-worker-idb-state-store
  |
  v
4 runtime-align-htf-kernel-port
  |
  v
5 runtime-request-security-mtf-and-canvas2d-flip
  |
  v
6 host-quickjs-scaffold-and-protocol-mirror
  |
  v
7 host-quickjs-impl-and-membrane
  |
  v
8 host-quickjs-sandbox-escape-and-bench
  |
  v
9 plotkind-expansion-and-renderers
  |
  v
10 define-alert-condition
  |
  v
11 runtime-log-and-error
  |
  v
12 draw-table
  |
  v
13 color-helpers
  |
  v
14 volume-profile-shared-lib-port
  |
  v
15 ta-visible-range-volume-profile
  |
  v
16 ta-anchored-volume-profile
  |
  v
17 ta-session-volume-profile
  |
  v
18 ta-fixed-range-volume-profile
  |
  v
19 phase-closeout
```

Execution is strictly sequential. Each task's prerequisites are
satisfied by all lower-numbered tasks.

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|------------|--------------|-----------------|
| 1 | [Core: `StateSnapshot` / `StreamSnapshot` / `StateStoreKey` types](./1-core-state-snapshot-types.md) | core | None | Low |
| 2 | [Runtime: `PersistentStateStore` sub-interface + snapshot/restore wiring](./2-runtime-persistent-state-store.md) | runtime | 1 | High |
| 3 | [host-worker: `idbStateStore` subpath export](./3-host-worker-idb-state-store.md) | host-worker | 2 | Medium |
| 4 | [Runtime: `align-htf-series-to-ltf` + cache port](./4-runtime-align-htf-kernel-port.md) | runtime | 3 | Medium |
| 5 | [Runtime: `request.security` real HTF path + canvas2d MTF flip](./5-runtime-request-security-mtf-and-canvas2d-flip.md) | runtime, examples/canvas2d-adapter | 4 | High |
| 6 | [host-quickjs: scaffold + protocol mirror](./6-host-quickjs-scaffold-and-protocol-mirror.md) | host-quickjs | 5 | Medium |
| 7 | [host-quickjs: `createQuickJsHost` impl + JsonValue membrane](./7-host-quickjs-impl-and-membrane.md) | host-quickjs | 6 | High |
| 8 | [host-quickjs: sandbox-escape suite + bench](./8-host-quickjs-sandbox-escape-and-bench.md) | host-quickjs | 7 | Medium |
| 9 | [PlotKind expansion (8 new kinds) + canvas2d renderers](./9-plotkind-expansion-and-renderers.md) | core, adapter-kit, runtime, examples/canvas2d-adapter | 8 | High |
| 10 | [`defineAlertCondition` + `AlertConditionEmission` + capability gating](./10-define-alert-condition.md) | core, compiler, runtime, adapter-kit, examples/canvas2d-adapter | 9 | High |
| 11 | [`runtime.log.*` + `runtime.error()` + `LogEmission`](./11-runtime-log-and-error.md) | core, runtime, adapter-kit, examples/canvas2d-adapter | 10 | Medium |
| 12 | [`draw.table` + `TableCell` + `DrawingKind = "table"` + viewport renderer](./12-draw-table.md) | core, adapter-kit, runtime, examples/canvas2d-adapter | 11 | Medium |
| 13 | [Color helpers: `fromGradient` / `withAlpha` / `rgb` / `hsl`](./13-color-helpers.md) | core | 12 | Low |
| 14 | [Volume-profile shared lib port (`bucket-edges`, `value-area`, `bucketize-volume`, …)](./14-volume-profile-shared-lib-port.md) | runtime | 13 | Medium |
| 15 | [`ta.visibleRangeVolumeProfile` port + full §22.10 set](./15-ta-visible-range-volume-profile.md) | core, runtime | 14 | High |
| 16 | [`ta.anchoredVolumeProfile` port + full §22.10 set](./16-ta-anchored-volume-profile.md) | core, runtime | 15 | High |
| 17 | [`ta.sessionVolumeProfile` port + full §22.10 set](./17-ta-session-volume-profile.md) | core, runtime | 16 | High |
| 18 | [`ta.fixedRangeVolumeProfile` port + full §22.10 set](./18-ta-fixed-range-volume-profile.md) | core, runtime | 17 | High |
| 19 | [Phase closeout — `docs:generate` sweep, version bumps, changeset bundle](./19-phase-closeout.md) | all | 18 | Low |

## Code Reuse

| Existing artefact | Reuse for |
|-------------------|-----------|
| `packages/runtime/src/stateStore.ts` `StateStore` + `inMemoryStateStore` | Task 2's `PersistentStateStore` is a **sibling** sub-interface — not a replacement. The Phase-1 slot store carries on serving primitive slot state. |
| `packages/core/src/types.ts` `JsonValue` | Task 1's `StateSnapshot.slots: Readonly<Record<string, JsonValue>>` reuses this — no parallel "snapshot-safe value" type. |
| `packages/core/src/types.ts` `IntervalDescriptor` | Task 1 references this in `StateStoreKey.requestedIntervals`; Task 4 uses it for the alignment kernel's stream metadata. |
| `packages/runtime/src/runtimeContext.ts` `RuntimeContext` | Tasks 2 / 4 / 5 / 10 / 11 extend it with `persistentStateStore?`, `htfAlignmentCache`, `secondaryStreams`, `alertConditions`, and `logBudget`. Same file, additive. |
| `packages/runtime/src/streamState.ts` `createStreamState` | Task 5 reuses this for every secondary stream — one `StreamState` per `request.security` interval. No new stream constructor. |
| `packages/runtime/src/request/` Phase-4 NaN stub | Task 5 replaces only the *value producer*; the per-callsite cache + diagnostic dedup map stay as-is (RUNTIME CLAUDE.md invariant). |
| `packages/host-worker/src/protocol.ts` `HostToWorker` / `WorkerToHost` | Task 6 mirrors these byte-for-byte for `host-quickjs`. The membrane (Task 7) translates between QuickJS handles and these JSON-clean frames. |
| `packages/host-worker/src/createWorkerHost.ts` API surface | Task 7's `createQuickJsHost` returns the same frozen `ScriptHost`. Tests share patterns. |
| `packages/host-worker/src/sandbox.test.ts` | Task 8's sandbox-escape suite mirrors the worker host's pattern (assert specific escape attempts fail with the expected error). |
| `packages/adapter-kit/src/types.ts` `Capabilities` (all 13 fields) | Task 10 / 11 use `Capabilities.alertConditions` / `Capabilities.logs` — Phase 4 already declared the shape. |
| `packages/adapter-kit/src/types.ts` `RunnerEmissions` | Tasks 10 / 11 add `alertConditions: ReadonlyArray<AlertConditionEmission>` and `logs: ReadonlyArray<LogEmission>` fields. Same union; additive. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Tasks 10 / 11 / 12 add new emission validators alongside the existing `validatePlotEmission` / `validateAlertEmission` / `validateDrawingEmission`. Same module; additive. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` builder set | Tasks 10 / 11 add `capabilities.alertConditions(...)` / `capabilities.logs(...)` builders. Task 9 widens the kind sets accepted by `capabilities.plots(...)` / `capabilities.drawings(...)`. |
| `packages/core/src/plot/plot.ts` `PlotKind` + `PlotOptsStyle` | Task 9 widens the unions in place. The compile-time hole pattern (`function plot(...) { throw … }`) is unchanged. |
| `packages/core/src/draw/drawingKind.ts` `DrawingKind` + `DRAWING_KINDS` array | Task 12 appends `"table"` to the union + the iterable array + the camelCase / kebab-case maps. |
| `packages/core/src/draw/draw.ts` namespace shape | Task 12 adds `draw.table(opts)` matching the existing per-function pattern (compile-time stub that throws outside the runtime). |
| `packages/core/src/draw/buckets.ts` `KIND_BUCKET` | Task 12 maps `"table"` → `"other"` bucket per §10.2. |
| `packages/core/src/define/defineAlert.ts` `defineAlert` | Task 10's `defineAlertCondition.ts` mirrors the shape (frozen manifest + compute fn) but with a `conditions` map and a `signal(conditionId, fired)` ComputeContext extension. |
| `packages/core/src/statefulPrimitives.ts` `STATEFUL_PRIMITIVES` set | Tasks 10 / 11 / 12 / 15–18 append entries. Final cardinality test grows from 163 → 171 (Task 10 +1, Task 11 +2, Task 12 +1, Tasks 15–18 +4). |
| `packages/compiler/src/analysis/extractCapabilities.ts` | Task 10 adds an `extractAlertConditions` pass alongside it; same walker pattern. |
| `packages/compiler/src/program.ts` `CORE_AMBIENT_SHIM` | Tasks 1 / 9 / 10 / 11 / 12 / 13 / 15–18 each append their new core declarations to the shim. |
| `packages/runtime/src/buildComputeContext.ts` | Tasks 5 / 10 / 11 / 12 / 13 / 15–18 extend the returned `ComputeContext`. Same file, additive. |
| `packages/conformance/src/runConformanceSuite.ts` assertion variants | Tasks 5 / 10 / 11 / 12 / 15–18 reuse existing `plot-hash` / `drawing-hash` / `diagnostic-code-present` / `diagnostic-code-absent`. A new `alert-condition-fired-at-bar` variant lands in Task 10 (smallest possible addition). |
| `examples/canvas2d-adapter/src/capabilities.ts` `CANVAS2D_CAPABILITIES` | Tasks 5 / 9 / 10 / 11 / 12 extend with Phase-5 widenings. |
| Existing `*.bench.test.ts` pairs in `packages/runtime/src/ta/` | Tasks 4 / 14 / 15 / 16 / 17 / 18 follow the established bench-pair pattern: `<id>.bench.ts` (vitest bench mode) + `<id>.bench.test.ts` (THRESHOLD_MS assertion). |
| `scripts/docs-check.ts` + `scripts/gen-docs.ts` | Every new public surface auto-generates a `docs/primitives/{plot,draw,color,runtime,define,request,ta}/*.md` page on `pnpm chartlang docs`. No bespoke doc files. |

## Provenance

Phase 5 carries the following ports from
`../invinite/src/components/trading-chart/`:

| chartlang file | Invinite source | Commit SHA | Task |
|----------------|-----------------|------------|------|
| `packages/runtime/src/request/alignHtfSeriesToLtf.ts` | `indicators/lib/align-htf-series-to-ltf.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 4 |
| `packages/runtime/src/request/alignHtfSeriesCache.ts` | `indicators/lib/align-htf-series-cache.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 4 |
| `packages/runtime/src/ta/lib/volume-profile/bucketEdges.ts` | `indicators/lib/volume-profile/bucket-edges.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/bucketizeVolume.ts` | `indicators/lib/volume-profile/bucketize-volume.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/valueArea.ts` | `indicators/lib/volume-profile/value-area.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/intercept.ts` | `indicators/lib/volume-profile/intercept.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/tooHeavy.ts` | `indicators/lib/volume-profile/too-heavy.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/developingSeries.ts` | `indicators/lib/volume-profile/developing-series.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/lib/volume-profile/volumeProfileShared.ts` | `indicators/lib/volume-profile/volume-profile-shared.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 14 |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.ts` | `indicators/visible-range-volume-profile.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 15 |
| `packages/runtime/src/ta/anchoredVolumeProfile.ts` | `indicators/anchored-volume-profile.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 16 |
| `packages/runtime/src/ta/sessionVolumeProfile.ts` | `indicators/session-volume-profile.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 17 |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.ts` | `indicators/fixed-range-volume-profile.ts` | `3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4` | 18 |

Every port carries the standard 4-line provenance header (per
CONTRIBUTING.md):

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/<path> @ <sha>.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

## Deferred / Follow-Up Work

The following Phase-5-adjacent items are intentionally **NOT** in
scope and land in Phase 6 or beyond:

- **Tier-3 / LTF (lower-timeframe) `request.lowerTf`** — Phase 6.
  Requires `Capabilities.multiTimeframe: true` (Phase 5 lands the
  capability flip; the LTF *direction* of `request` is Phase 6).
- **`IntervalDescriptor.intervalSeconds?: number`** — Phase 6.
  PLAN §4.9 reserves the optional override for exotic intervals.
  Phase 5 keeps `timeframe.inSeconds` derived from
  `group × numeric prefix(value)` only.
- **Server-side `PersistentStateStore` backings** (Convex, Postgres,
  Redis) — out of OSS scope. PLAN §6.9 + §15 specify these live in
  consumer repos. The conformance suite uses
  `inMemoryPersistentStateStore` only.
- **`state.array(...)` / `state.map(...)`** — beyond 1.0. The §4.6
  out-of-scope note still applies; Phase 5 keeps `state.*` scalar-
  only.
- **Monaco / vanilla DOM editor adapters** — out of scope. The
  language-service stays editor-agnostic.
- **Marketplace metadata** — beyond 1.0.
- **`runtime.timer` / scheduled tasks** — not in PLAN. Scripts stay
  bar-driven.
- **Bespoke alert-channel adapters (Slack, Discord, SMS)** — out of
  OSS scope. Consumer adapters wire their own; Phase 5 ships the
  channel-agnostic `defineAlertCondition.signal()` surface only.

Phase 5 closes when:

- [ ] Every task's `Acceptance Criteria` is checked off.
- [ ] `pnpm -r test` shows 100% coverage on every affected package.
- [ ] `pnpm conformance` is green against the canvas2d reference
      adapter — including the new MTF, persistence determinism,
      alert-condition, log, draw.table, and volume-profile scenarios.
- [ ] A script running under `host-quickjs` produces byte-identical
      emissions vs `host-worker` for the same input candles
      (cross-host determinism test).
- [ ] A snapshot saved at bar 4000 of 5000 + cold-loaded into a
      fresh runtime + replayed from bar 4001 onward emits byte-
      identically to a full cold replay (warm-start determinism test).
- [ ] `pnpm docs:check` is green; new `docs/primitives/` pages exist
      for every new core surface.
- [ ] `pnpm readme:check` is green; every package README ≤ 100 lines.
- [ ] Every affected package's `package.json` version is bumped to
      `0.5.x` via the bundled changeset.
- [ ] `host-quickjs` `roundTrip` bench reports ≤100× the
      `host-worker` baseline per PLAN §8.3.
