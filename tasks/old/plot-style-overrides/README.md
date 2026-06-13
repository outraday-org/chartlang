# Plot Style Overrides

> **Status: TODO.** Adds a first-class, host-supplied **plot override**
> channel (per-`slotId` visibility + color + line width/style) so an
> embedder can recolor and show/hide individual plots of a running
> script **without editing the script source** — the TradingView "Style
> tab" model. Today the only way a plot gets its color / width / line
> style is the author's literal `plot(value, { color, ... })` call (or an
> author-wired `input.color`); there is no embedder-side channel to
> override or hide a plot, and `PlotEmission` carries no visibility flag.
>
> **Plan reference:** PLAN.md §7.1 (`Adapter`), §7.2 (`Capabilities`),
> §7.3 (`PlotEmission` wire schema), §16.3 (per-package test layers —
> the new host-quickjs wire requires a sandbox-escape test). Mirrors
> the existing `resolveInputs` / `inputOverrides` mount channel
> (`packages/host-worker/src/createWorkerHost.ts:188-190`,
> `packages/runtime/src/createScriptRunner.ts:318`,
> `packages/host-quickjs/src/createQuickJsHost.ts:271-273`).
>
> **Version target:** per-package minor bump across `core`,
> `adapter-kit`, `compiler`, `runtime`, `host-worker`, `host-quickjs`.
> Fully additive: with no overrides supplied, every emission is
> byte-identical to today (the new `visible` field is omitted unless a
> plot is explicitly hidden).

## Goal

Two additive capabilities, both keyed by the compiler-issued
`PlotEmission.slotId`:

1. **A static plot-slot manifest.** The compiler emits
   `ScriptManifest.plots: PlotSlotDescriptor[]` — one entry per
   `plot()` / `hline()` callsite (`slotId`, statically-known plot
   `kind`, literal `title` when present). An embedder can build a Style
   tab **before the first emission** and key its override rows by
   `slotId`, deterministically.

2. **A plot-override channel.** A host carries an initial
   `plotOverrides: Record<slotId, PlotOverride>` in the `load` frame
   (resolved from a new `Adapter.resolvePlotOverrides` callback, exactly
   like `inputOverrides` / `resolveInputs`), AND can push live updates
   mid-run via a new `host.setPlotOverrides(...)`. The runtime applies
   each override at emit time:

   - `visible: false` → the emission carries `visible: false` (the
     adapter skips rendering + scale inclusion; the slot stays listed).
   - `color` → overwrites `PlotEmission.color`.
   - `lineWidth` / `lineStyle` → merged into the `style` object for the
     line-family kinds (`line`, `step-line`, `horizontal-line`, `area`).

   **`inputs` stay frozen-at-mount** (they feed `compute`); **plot
   overrides are presentation-only** and therefore live-updatable
   without a recompile/remount.

The canvas2d reference adapter is taught to honor `visible` + the
override fields so the conformance suite can pin the behavior end-to-end.

## Current State

- **`packages/adapter-kit/src/types.ts:457-468`** — `PlotEmission` has
  `kind / slotId / title / style / bar / time / value / color / meta /
  pane`. **No `visible` field.** `PlotStyle` line-family arms
  (`packages/adapter-kit/src/types.ts:326-353` — `line`, `step-line`,
  `horizontal-line`, `area`) carry `lineWidth` + `lineStyle`.
- **`packages/adapter-kit/src/types.ts:727-759`** — `Adapter` has
  `resolveInputs?(scriptId) => Readonly<Record<string, unknown>>` (line
  744) but **no plot-override resolver**. `PlotKind` /
  `DrawingCounts` re-exports from core sit at lines 78 / 188.
- **`packages/adapter-kit/src/validation/validateEmission.ts`** — the
  defence-in-depth plot validator (`VALID_PLOT_STYLE_KINDS` at lines
  53-70); has no `visible` arm.
- **`packages/core/src/types.ts:266-426`** — `ScriptManifest` has
  `inputs` (270), optional `outputs?` (384, titled plots only, keyed by
  `title` not `slotId`; `OutputDeclaration` lives in
  `packages/core/src/define/dependency.ts:21-24`). **No `plots` field;
  no `PlotSlotDescriptor` type.** `LineStyle` is at
  `packages/core/src/types.ts:140` (`"solid" | "dashed" | "dotted"`);
  `PlotKind` is at `packages/core/src/plot/plot.ts:30-46`.
- **`packages/compiler/src/transformers/callsiteIdInjection.ts`** —
  `injectCallsiteIds` mints the `slotId` at line 91 in the format
  `` `${sourcePath}:${line + 1}:${character + 1}#0` `` and rewrites
  every `plot()` / `plot.*()` / `hline()` callsite (see
  `docs/primitives/plot/plot.md`). It already enumerates these
  callsites but does not record them on the manifest as a slot list.
  `buildManifest` (`packages/compiler/src/manifest.ts:33`) spreads
  `outputs` conditionally at line 128 (`...(outputs === undefined ? {}
  : { outputs })`); the compiler has **no** plot-namespace →
  `PlotKind` mapping today (the runtime's `buildStyle` operates on
  `opts.style` at emit time, not on the static callee name).
- **`packages/host-worker/src/createWorkerHost.ts`** —
  `CreateWorkerHostOpts` (lines 39-46) has `resolveInputs?` at line 42;
  the `load` frame (`:181-193`) spreads `inputOverrides:
  opts.resolveInputs(compiled.manifest.name)` at lines 188-190. **No
  `resolvePlotOverrides` / `plotOverrides`.** `protocol.ts:29-40` types
  the `HostToWorker` `load` arm (with `inputOverrides?` at line 37);
  `types.ts:149-156` declares `ScriptRunnerHandle` (worker-side wrapper
  over the runtime's `ScriptRunner`); `createWorkerBoot.ts:140-160`
  threads `inputOverrides` into `createScriptRunner` (line 149).
- **`packages/host-quickjs/`** — the server-side host. Entry
  `createQuickJsHost.ts:226-354`; `protocol.ts:29-40` (`HostToQuickJs`
  with `inputOverrides?` at line 35); guest-side dispatch in
  `dispatcherCore.ts:218-235`. Mirrors the worker host's `load`
  plumbing through the QuickJS JSON membrane.
- **`packages/runtime/src/createScriptRunner.ts`** — `ScriptRunner`
  type at lines 125-133 (`onHistory` / `onBarClose` / `onBarTick` /
  `push` / `warmStart` / `drain` / `dispose`); `CreateScriptRunnerArgs`
  at lines 153-171 (`inputOverrides?` / `resolveInputs?` at lines
  169-170); line 318 resolves `args.inputOverrides ??
  args.resolveInputs?.(primary.manifest.name) ?? Object.freeze({})`
  into `runtimeContext.resolvedInputs` (319, frozen).
  `runtimeContext.ts:230` declares `resolvedInputs`. **No plot-override
  field.**
- **`packages/runtime/src/emit/plot.ts:86-122`** — `plotImpl` builds the
  `PlotEmission` (`:108-119`, `color: opts.color ?? null`) and calls
  `pushPlot` (line 121). The local `buildStyle` helper (lines 26-84)
  resolves `opts.style` → `PlotStyle`. **No override application.**
  `packages/runtime/src/emit/hline.ts` builds its own emission with
  hardcoded `pane: "overlay"` the same way.
- **`packages/conformance/`** — 238+ `.scenario.ts` files; none
  exercises plot overrides. Scenarios are imported + re-exported in
  `packages/conformance/src/scenarios/index.ts` and appended to
  `ALL_SCENARIOS` (line 476). Determinism is defined over "same
  compiled bundle, candle stream, inputs, symInfo, capabilities" (PLAN
  §6.4 + §6.9). Plot overrides are a new axis not yet covered.

## Target State

### Core (`packages/core/`)

- New exported type `PlotSlotDescriptor`:
  ```ts
  export type PlotSlotDescriptor = {
      readonly slotId: string;
      readonly kind: PlotKind;       // statically-known callee kind
      readonly title?: string;       // present only when the opts title is a string literal
  };
  ```
- `ScriptManifest.plots?: ReadonlyArray<PlotSlotDescriptor>` — additive,
  optional (absent on scripts with no plot/hline callsites, mirroring
  how `outputs?` is absent without literal titles). JSON-clean,
  deterministic ordering (callsite order).
- New exported type `PlotOverride`:
  ```ts
  export type PlotOverride = {
      readonly visible?: boolean;          // false hides without removing
      readonly color?: string;             // CSS color override
      readonly lineWidth?: number;         // line-family kinds only
      readonly lineStyle?: LineStyle;      // line-family kinds only
  };
  ```

### Adapter-kit (`packages/adapter-kit/`)

- Re-export `PlotSlotDescriptor` + `PlotOverride` from core (same
  pattern as `PlotKind` / `DrawingCounts`).
- `PlotEmission.visible?: boolean` — **optional**, omitted ⇒ visible.
  Only ever present as `false`, set by the runtime when an override
  hides the slot. (Keeping it omitted-by-default makes every
  no-override emission byte-identical to today.)
- `Adapter.resolvePlotOverrides?: (scriptId: string) =>
  Readonly<Record<string, PlotOverride>>` — optional, `@since` this
  minor. JSDoc mirrors `resolveInputs`.
- `validateEmission` accepts an optional `visible: boolean` on plot
  emissions and rejects any other type.

### Compiler (`packages/compiler/`)

- The callsite-rewrite pass accumulates a `PlotSlotDescriptor` per
  `plot()` / `plot.*()` / `hline()` call: `slotId` (already issued),
  `kind` (from the callee — `plot` ⇒ `"line"`, `plot.histogram` ⇒
  `"histogram"`, `hline` ⇒ `"horizontal-line"`, etc.), and `title` when
  the opts object literal carries a string-literal `title`.
  Dynamic-kind callsites (`plot(x, { style: someVar })`) still record a
  slot-only entry (`kind` falls back to `"line"` with a `// best-effort`
  note in the impl) so the slot is always listed; dynamic titles are
  omitted. `buildManifest` writes the array to `manifest.plots`.
- The compiler's ambient `ScriptManifest` shim gains `plots?`.
- `manifest.test.ts` pins: a two-plot + one-hline script round-trips a
  3-entry `plots` array with correct `slotId` / `kind` / literal
  titles; an untitled plot yields an entry with no `title`.

### Runtime (`packages/runtime/`)

- `RuntimeContext` gains `plotOverrides: Record<string, PlotOverride>`
  (**mutable**, not frozen — presentation overrides update live).
- `createScriptRunner` resolves the initial map at mount:
  `args.plotOverrides ?? args.resolvePlotOverrides?.(manifest.name) ?? {}`.
- New `ScriptRunnerHandle.setPlotOverrides(next)` replaces
  `ctx.plotOverrides` in place (shallow-frozen entries). Cheap, no
  recompute — the next `drain` reflects it.
- New shared helper `packages/runtime/src/emit/applyPlotOverride.ts`:
  `applyPlotOverride(emission, override) => PlotEmission`. Pure; sets
  `visible: false` only when `override.visible === false`; overwrites
  `color`; for line-family `style.kind`, merges `lineWidth` / `lineStyle`.
- `plot.ts:108-121` and `hline.ts` look up
  `ctx.plotOverrides[slotId]` and pass the built emission through
  `applyPlotOverride` before `pushPlot`.

### Hosts (`packages/host-worker/`, `packages/host-quickjs/`)

- `CreateWorkerHostOpts.resolvePlotOverrides?` (mirror `resolveInputs`).
- `load` frame spreads `plotOverrides: opts.resolvePlotOverrides(manifest.name)`
  when present; `protocol.ts` + `types.ts` type the new field.
- New `ScriptHost.setPlotOverrides(overrides)` method + a
  `{ kind: "setPlotOverrides", overrides }` host→guest frame; the boot
  scope calls `runner.setPlotOverrides(...)`.
- `host-quickjs` mirrors the identical wiring for cross-host parity.

### Conformance + reference adapter (`packages/conformance/`, `examples/canvas2d-adapter/`)

- The canvas2d reference adapter honors `PlotEmission.visible === false`
  (skip the series in render + per-pane viewport) and applies override
  colors/styles already baked into the emission.
- New scenario `plotStyleOverrides.scenario.ts`: a 2-plot script run
  (a) with empty overrides → emissions byte-identical to the no-override
  baseline; (b) with `{ "<slotId>": { visible: false, color: "#f00" } }`
  → the hidden slot emits `visible: false` and the recolored slot emits
  `color: "#f00"`; (c) a `setPlotOverrides` mid-stream flips visibility
  on the next drain.
- Cross-host parity: both `host-worker` and `host-quickjs` produce
  identical drained emissions for the same fixed override set.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Overrides keyed by `slotId`, not title or input id** | `slotId` is the compiler-issued, stable, unique callsite id already on every emission. Titles are optional and non-unique; input ids only exist for author-wired inputs. `slotId` is the one identifier that always exists for every plotted value. |
| **`inputs` frozen-at-mount; `plotOverrides` live** | Inputs feed `compute` — changing them mid-run would break the frozen-input determinism guarantee, so they require a remount. Plot overrides are presentation-only (visibility / color / line cosmetics) applied at emit time; updating them live via `setPlotOverrides` is safe and gives embedders an instant Style-tab toggle without a recompile. |
| **`visible` omitted-by-default, only emitted as `false`** | Keeps every no-override run byte-identical to today, so existing conformance hashes and all 220 scenarios are unaffected. Absence means visible. |
| **Static `manifest.plots` rather than emission-discovered slots** | An embedder can render the full Style-tab plot list (and key override rows) the moment the script compiles — before any candle is pushed — and it covers untitled plots that `outputs?` omits. Deterministic and recompile-stable. |
| **Mirror the `resolveInputs` / `inputOverrides` channel exactly** | The mount-time host→guest override plumbing already exists and is conformance-proven. Adding a parallel `resolvePlotOverrides` / `plotOverrides` path is low-risk and keeps the two override kinds symmetric for adapter authors. |
| **Runtime applies overrides; adapter stays dumb** | Baking the override into the drained emission keeps the wire self-describing: an adapter renders `emission.color` / `emission.visible` without needing its own override map. Determinism for a fixed override set is preserved. |
| **Reference adapter honors `visible` in viewport too** | A hidden oscillator must not expand the price/subpane y-scale; skipping it in both render and `computeViewport` is the correct TradingView behavior and is what the conformance scenario pins. |

## Dependency Graph

```
Task 1 (core + adapter-kit: PlotSlotDescriptor, PlotOverride, PlotEmission.visible, resolvePlotOverrides, validateEmission)
   |
   +--> Task 2 (compiler: emit manifest.plots)
   |
   +--> Task 3 (runtime apply + setPlotOverrides; host-worker + host-quickjs forward + frame)
              |
              v
        Task 4 (conformance scenario + canvas2d reference adapter + docs + changesets)
```

Tasks 2 and 3 both depend only on Task 1's types and can proceed in
parallel; Task 4 depends on both (it pins compiler output, runtime
application, and host forwarding together).

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [Contract types: PlotSlotDescriptor, PlotOverride, PlotEmission.visible, resolvePlotOverrides](./1-contract-types.md) | core, adapter-kit | None | Medium |
| 2 | [Compiler: emit `manifest.plots` static slot descriptors](./2-compiler-plot-manifest.md) | compiler | 1 | Medium |
| 3 | [Runtime apply + live `setPlotOverrides`; host forward (worker + quickjs)](./3-runtime-and-host.md) | runtime, host-worker, host-quickjs | 1 | High |
| 4 | [Conformance scenario + canvas2d reference adapter + docs](./4-conformance-and-docs.md) | conformance, examples/canvas2d-adapter, docs | 2, 3 | Medium |

## Code Reuse

| Reuse | Source | Notes |
|---|---|---|
| `inputOverrides` mount channel | `host-worker/createWorkerHost.ts:188-190`, `host-worker/createWorkerBoot.ts:149`, `host-quickjs/createQuickJsHost.ts:271-273`, `host-quickjs/dispatcherCore.ts:218-235`, `runtime/createScriptRunner.ts:318` | `plotOverrides` copies this end-to-end shape exactly across both hosts. |
| `resolveInputs` callback signature | `adapter-kit/src/types.ts:744` | `resolvePlotOverrides` mirrors `(scriptId) => Readonly<Record<string, PlotOverride>>`. |
| `LineStyle` union | `core/src/types.ts:140` | `PlotOverride.lineStyle` reuses it — do not redeclare. |
| `PlotKind` union | `core/src/plot/plot.ts:30-46` | `PlotSlotDescriptor.kind` reuses it; compiler-private `plotKindFromCallee` returns the same. |
| `OutputDeclaration` manifest array pattern | `core/src/types.ts:384` (field) + `core/src/define/dependency.ts:21-24` (type) + `compiler/src/manifest.ts:100-128` (conditional spread) | `PlotSlotDescriptor` + `manifest.plots` follow the same optional-frozen-array convention. |
| Core→adapter-kit re-export pattern | `PlotKind = CorePlotKind` (`adapter-kit/src/types.ts:78`), `DrawingCounts = CoreDrawingCounts` (`:188`) | `PlotSlotDescriptor` / `PlotOverride` re-export the same way. |
| `setPlotOverrides` host frame | `host-worker/protocol.ts` `HostToWorker` union + `createWorkerBoot.ts` handler switch; `host-quickjs/protocol.ts` `HostToQuickJs` union + `dispatcherCore.ts` dispatch | New arm beside `load` / `candleEvent` / `drain` / `dispose` on both hosts. |
| `ScriptRunner` vs `ScriptRunnerHandle` | `runtime/createScriptRunner.ts:125-133` (`ScriptRunner` — runtime export), `host-worker/types.ts:149-156` (`ScriptRunnerHandle` — worker-boot wrapper) | `setPlotOverrides` is added to **both** types so the boot scope can call through. |
| Ambient core shim | `compiler/src/program.ts` `CORE_AMBIENT_SHIM` (template string at line 28; `ScriptManifest` shim at lines 1045-1068; `OutputDeclaration` at 1032-1035; `PlotKind` at 711-727) | Add `PlotSlotDescriptor` beside `OutputDeclaration`; add `plots?` to the manifest shim. `PlotOverride` is **not** shimmed (not used in script-side `compute`). |
| Conformance scenario registration | `conformance/src/scenarios/index.ts` (imports, re-exports, `ALL_SCENARIOS = Object.freeze([...])` near line 476), `conformance/src/index.ts` (root barrel re-export) | New scenario follows the exact same triple-registration pattern. |

## Provenance

No `../invinite/` ports. All work is chartlang-native. The downstream
consumer (the invinite trading-chart custom-indicator editor) is the
motivating use case but ships no code here.

## Deferred / Follow-Up Work

- **Per-slot `pane` override.** Moving a plot to a different subpane
  from the host is out of scope; pane is script-controlled.
- **Override persistence inside the host.** The IndexedDB
  `idbStateStore` persists compute state, not presentation overrides;
  embedders own override persistence (the invinite consumer stores them
  in the lane instance params).
- **`Capabilities`-gated override kinds.** v1 always accepts all four
  `PlotOverride` fields; a future `Capabilities.plotOverrides` set could
  let an adapter declare it cannot honor (say) `lineStyle`.
- **Marker/label cosmetic overrides.** v1 line/color/visibility covers
  the line-family + color; per-kind cosmetics for markers, labels, and
  fills are follow-up.
