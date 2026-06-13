# Task 3 — Runtime apply + live `setPlotOverrides`; host forward (worker + quickjs)

> **Status: TODO**

## Goal

Make plot overrides actually take effect:

- The runtime resolves an initial `plotOverrides` map at mount and
  applies the matching override to every `PlotEmission` at emit time
  (visibility / color / line width / line style), keyed by `slotId`.
- A new `ScriptRunner.setPlotOverrides(next)` (runtime) +
  `ScriptRunnerHandle.setPlotOverrides(next)` (host-worker wrapper at
  `packages/host-worker/src/types.ts:149-156`) swaps the map live (no
  recompute) so the next `drain` reflects it. (Runtime's exported
  handle type is `ScriptRunner` — `packages/runtime/src/createScriptRunner.ts:125`;
  host-worker's `ScriptRunnerHandle` is a separate, narrower wrapper
  used inside the worker boot. Both need the new method.)
- Both hosts (`host-worker`, `host-quickjs`) forward an initial
  `plotOverrides` in the `load` frame (mirroring `inputOverrides`) and
  expose `ScriptHost.setPlotOverrides(...)` via a new host→guest frame.

## Prerequisites

Task 1 (`PlotOverride`, `PlotEmission.visible?`, `resolvePlotOverrides`).

## Current Behavior

- `packages/runtime/src/runtimeContext.ts:230` — `resolvedInputs` is the
  only resolved-override field; it is frozen. No plot-override field.
- `packages/runtime/src/createScriptRunner.ts:318-319` — resolves
  `args.inputOverrides ?? args.resolveInputs?.(primary.manifest.name) ?? Object.freeze({})`
  into `resolvedInputs`. Args type `CreateScriptRunnerArgs` at lines
  153-171 carries `inputOverrides?` / `resolveInputs?` at lines 169-170.
  The exported handle type is `ScriptRunner` (lines 125-133) and
  exposes `onHistory` / `onBarClose` / `onBarTick` / `push` /
  `warmStart` / `drain` / `dispose`; no `setPlotOverrides`.
- `packages/runtime/src/emit/plot.ts:108-121` — builds the emission and
  calls `pushPlot` with no override step. `hline.ts` does the same for
  `horizontal-line`.
- `packages/host-worker/src/createWorkerHost.ts:181-193` — `load` frame
  spreads `inputOverrides: opts.resolveInputs(compiled.manifest.name)`
  conditionally (lines 188-190); `ScriptHost`
  (`packages/host-worker/src/types.ts`) has `load` / `push` / `drain` /
  `dispose` / `limits` only.
- `packages/host-worker/src/protocol.ts:29-40` — `HostToWorker` arms:
  `load` (with optional `inputOverrides?` at line 37) / `candleEvent` /
  `drain` / `dispose`.
- `packages/host-worker/src/types.ts:149-156` — `ScriptRunnerHandle`
  wraps the runtime's `ScriptRunner` inside the worker boot scope.
- `packages/host-worker/src/createWorkerBoot.ts:140-160` — `load`
  handler threads `inputOverrides` into `createScriptRunner`.
- `packages/host-quickjs/src/createQuickJsHost.ts:226-354` — host
  entrypoint; `CreateQuickJsHostOpts` (lines 48-55) carries
  `resolveInputs?`; the `load` method (lines 261-284) spreads
  `inputOverrides` into the `HostToQuickJs` frame.
- `packages/host-quickjs/src/protocol.ts:29-40` — `HostToQuickJs` arms:
  `load` (with `inputOverrides?` at line 35) / `candleEvent` / `drain` /
  `dispose` — JSON-stringified across the QuickJS membrane.
- `packages/host-quickjs/src/dispatcherCore.ts:218-235` — guest-side
  `load` handler threads `inputOverrides` into `createScriptRunner`
  (mirrors `createWorkerBoot.ts`).

## Desired Behavior

### Runtime

1. **`runtimeContext.ts`** — add a **mutable** field after
   `resolvedInputs`:
   ```ts
   /**
    * Host-supplied per-slot presentation overrides, keyed by
    * `PlotEmission.slotId`. Applied at emit time by `applyPlotOverride`.
    * Mutable — `setPlotOverrides` swaps it live (presentation-only, so
    * it does not break the frozen-input determinism guarantee).
    * @since <minor>
    */
   plotOverrides: Readonly<Record<string, PlotOverride>>;
   ```
   (Not `readonly` on the context — the handle replaces it. Entries
   themselves are frozen.)

2. **`createScriptRunner.ts`** — resolve at mount:
   ```ts
   state.runtimeContext.plotOverrides =
       args.plotOverrides ?? args.resolvePlotOverrides?.(primary.manifest.name) ?? Object.freeze({});
   ```
   Add `plotOverrides?` + `resolvePlotOverrides?` to the args type
   beside `inputOverrides?` / `resolveInputs?` (169-170). Expose on the
   returned handle:
   ```ts
   setPlotOverrides(next: Readonly<Record<string, PlotOverride>>): void {
       state.runtimeContext.plotOverrides = Object.freeze({ ...next });
   }
   ```
   Dep / sibling runners (`dep/DepRunner.ts`) default `plotOverrides` to
   `Object.freeze({})` — overrides target the primary script's slots
   only in v1 (document this; dep-output plots are not host-overridable).

3. **`packages/runtime/src/emit/applyPlotOverride.ts`** — new pure
   helper. JSDoc must carry `@since <minor>`, `@stable`, and an
   executable `@example` (the docs-check executor runs it):
   ```ts
   /**
    * Apply a `PlotOverride` to a built `PlotEmission`. Pure / immutable —
    * returns the input unchanged when `override` is `undefined`, sets
    * `visible: false` only when `override.visible === false`, overwrites
    * `color`, and merges `lineWidth` / `lineStyle` into `style` only
    * when the emission's `style.kind` is line-family
    * (`line | step-line | horizontal-line | area`). Non-line kinds
    * ignore width/style silently (no diagnostic).
    *
    * @since <minor>
    * @stable
    * @example
    *     const emission: PlotEmission = {
    *         kind: "plot", slotId: "s", title: "", style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
    *         bar: 0, time: 0, value: 1, color: null, meta: {}, pane: "overlay",
    *     };
    *     const next = applyPlotOverride(emission, { color: "#f00" });
    *     void next;
    */
   export function applyPlotOverride(
       emission: PlotEmission,
       override: PlotOverride | undefined,
   ): PlotEmission {
       if (override === undefined) return emission;
       let next = emission;
       if (override.visible === false) next = { ...next, visible: false };
       if (override.color !== undefined) next = { ...next, color: override.color };
       if (
           (override.lineWidth !== undefined || override.lineStyle !== undefined) &&
           isLineFamily(next.style.kind)
       ) {
           next = {
               ...next,
               style: {
                   ...next.style,
                   ...(override.lineWidth !== undefined ? { lineWidth: override.lineWidth } : {}),
                   ...(override.lineStyle !== undefined ? { lineStyle: override.lineStyle } : {}),
               },
           };
       }
       return next;
   }
   ```
   `isLineFamily` ⇒ `"line" | "step-line" | "horizontal-line" | "area"`.
   `visible` is only ever written as `false` (never `true`) so
   no-override and visible-override emissions stay byte-identical to
   today. Width/style on a non-line kind is ignored (no-op, no
   diagnostic — presentation overrides degrade silently like capability
   fallback).

4. **`plot.ts` + `hline.ts`** — after building `emission`, before
   `pushPlot`:
   ```ts
   pushPlot(ctx.emissions, applyPlotOverride(emission, ctx.plotOverrides[slotId]));
   ```

5. **Tests** — `applyPlotOverride.test.ts` (every branch: undefined,
   visible-false, visible-true (= no-op, omits the field), color,
   width+style on line, width-only on line, style-only on line, width
   on histogram = no-op, combined; plus a property test per §16.3:
   applying an empty `{}` override returns deep-equal emission for any
   randomly generated valid emission). `plot.test.ts` / `hline.test.ts`
   add an override-in-context case (RuntimeContext seeded with a
   matching slot override). `createScriptRunner.test.ts` covers mount
   resolution via both paths (`args.plotOverrides` short-circuit AND
   `args.resolvePlotOverrides` callback) + `setPlotOverrides` live swap
   reflected on the next emit + no-recompute (no extra `compute` call
   between swap and next drain).

### Hosts

6. **`host-worker`**
   - `CreateWorkerHostOpts.resolvePlotOverrides?: (scriptId) =>
     Readonly<Record<string, PlotOverride>>`.
   - `load` frame: spread
     `plotOverrides: opts.resolvePlotOverrides(compiled.manifest.name)`
     when present (beside the existing `inputOverrides` spread, 188).
   - `protocol.ts` `HostToWorker`: add `plotOverrides?` to the `load`
     arm AND a new arm
     `{ readonly kind: "setPlotOverrides"; readonly overrides: Readonly<Record<string, PlotOverride>> }`.
     `types.ts:216` load type gains `plotOverrides?`.
   - `ScriptHost.setPlotOverrides(overrides)` method on the returned
     handle → `worker.postMessage({ kind: "setPlotOverrides", overrides })`.
   - `createWorkerBoot.ts`: pass `plotOverrides` into
     `createScriptRunner` on `load` (beside `inputOverrides`, 149); add a
     `setPlotOverrides` handler arm → `runner.setPlotOverrides(msg.overrides)`.

7. **`host-quickjs`** — mirror items in (6) explicitly, file-by-file:
   - **`packages/host-quickjs/src/createQuickJsHost.ts`** —
     `CreateQuickJsHostOpts` (lines 48-55) gains
     `resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>`.
     The `load` method (lines 261-284) spreads
     `plotOverrides: opts.resolvePlotOverrides(compiled.manifest.name)`
     into the `HostToQuickJs` `load` frame when present. The returned
     `ScriptHost` gains `setPlotOverrides(overrides)` → wraps a new
     `__chartlang_setPlotOverrides` JSON call (extend the
     `callAsyncJson` / `callSyncJson` switch in
     `createQuickJsHost.ts` and the matching guest entrypoint in
     `dispatcher.ts` / `dispatcherCore.ts`).
   - **`packages/host-quickjs/src/protocol.ts`** — `HostToQuickJs` adds
     `plotOverrides?` to the `load` arm (line 35 region) and a new
     `{ readonly kind: "setPlotOverrides"; readonly overrides: Readonly<Record<string, PlotOverride>> }`
     arm.
   - **`packages/host-quickjs/src/dispatcherCore.ts`** — `load`
     handler (lines 218-230) threads `frame.plotOverrides` into
     `createScriptRunner` beside the existing `frame.inputOverrides`
     spread; add a `case "setPlotOverrides":` to the dispatch switch
     that calls `runner.setPlotOverrides(msg.overrides)` and replies
     with `{ kind: "ack" }`.
   - **`packages/host-quickjs/src/dispatcher.ts`** — re-export /
     thread the new entry point if the dispatcher pre-exports
     specific frame kinds.
   - **`packages/host-quickjs/src/types.ts`** — extend `ScriptHost`
     with the `setPlotOverrides(overrides)` method (same shape as
     host-worker for cross-host parity).
   - **JSON membrane note** — `plotOverrides` and the
     `setPlotOverrides` frame payload are JSON-clean by construction
     (no Sets / functions / class instances); the existing
     `stringifyFrame` (createQuickJsHost.ts:81-88) handles them
     without changes.

   Required for cross-host parity (Task 4 asserts it).

8. **Host tests**
   - **`createWorkerHost.test.ts`** — mirror the `inputOverrides` test
     at lines 160-180: a `resolvePlotOverrides` returning
     `{ "<slot>": { visible: false } }` lands `plotOverrides` on the
     load frame; a `host.setPlotOverrides({...})` call posts the new
     `setPlotOverrides` frame to the worker.
   - **`createQuickJsHost.test.ts`** — same shape, using the existing
     QuickJS test harness; assert the JSON-stringified load frame
     contains `plotOverrides`, and that `host.setPlotOverrides({...})`
     invokes `__chartlang_setPlotOverrides` with the JSON-cleaned
     overrides payload.
   - **`packages/host-quickjs/src/sandbox.test.ts`** — add a
     sandbox-escape assertion for the new wire surface: an override
     payload containing a getter / `Function`-shaped value at the host
     side reaches the guest as plain JSON (no live reference), and a
     malicious `setPlotOverrides` payload cannot mutate the guest's
     compute state. Required per PLAN §16.3 "sandbox-escape" gate on
     host-quickjs.

## Edge Cases

- **Override for an unknown `slotId`** — `ctx.plotOverrides[slotId]` is
  `undefined`; `applyPlotOverride` returns the emission unchanged. No
  diagnostic (the embedder may legitimately hold overrides for slots not
  emitted this tick).
- **`visible: true` in an override** — treated as "no visibility change"
  (we never write `visible: true`), so the emission omits the field and
  renders. Documented in the helper JSDoc.
- **Warm start / state persistence** — `plotOverrides` is mount-resolved
  and presentation-only; it is **not** part of the persisted compute
  snapshot (`StateStoreKey`). A warm start re-resolves it from the host,
  so the determinism guarantee (which is defined over compute state) is
  unaffected.
- **Determinism contract** — extends to "same … inputs, **same plot
  overrides**, …": for a fixed override snapshot the drained emissions
  are byte-identical across hosts. Empty overrides ⇒ identical to the
  pre-feature baseline.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/runtimeContext.ts` | Modify | Mutable `plotOverrides` field |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Mount resolution + `setPlotOverrides` handle method + args |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Mount + live-swap tests |
| `packages/runtime/src/emit/applyPlotOverride.ts` | Create | Pure override applicator |
| `packages/runtime/src/emit/applyPlotOverride.test.ts` | Create | Branch coverage |
| `packages/runtime/src/emit/plot.ts` | Modify | Apply override before `pushPlot` |
| `packages/runtime/src/emit/hline.ts` | Modify | Apply override before `pushPlot` |
| `packages/runtime/src/emit/plot.test.ts` / `hline.test.ts` | Modify | Override-in-context cases |
| `packages/runtime/src/dep/DepRunner.ts` | Modify | Default `plotOverrides` to `{}` |
| `packages/runtime/src/index.ts` | Modify | Export `applyPlotOverride` (needed by `applyPlotOverride.test.ts` cross-package callers and to make the override-application contract publicly inspectable) |
| `packages/host-worker/src/createWorkerHost.ts` | Modify | `resolvePlotOverrides` opt (after `resolveInputs?`, ~line 42) + load spread (beside `inputOverrides`, lines 188-190) + `setPlotOverrides` on returned `ScriptHost` |
| `packages/host-worker/src/protocol.ts` | Modify | `plotOverrides?` on `load` arm (line 37 region) + new `setPlotOverrides` arm |
| `packages/host-worker/src/types.ts` | Modify | `ScriptHost.setPlotOverrides`; also extend `ScriptRunnerHandle` (lines 149-156) with `setPlotOverrides` so the boot scope can call through |
| `packages/host-worker/src/createWorkerBoot.ts` | Modify | Thread `plotOverrides` into `createScriptRunner` (beside `inputOverrides` at line 149); add `case "setPlotOverrides":` to the handler switch |
| `packages/host-worker/src/createWorkerHost.test.ts` | Modify | `resolvePlotOverrides` → `plotOverrides` on load frame; `host.setPlotOverrides(...)` → posted `setPlotOverrides` frame |
| `packages/host-quickjs/src/createQuickJsHost.ts` | Modify | `resolvePlotOverrides` opt + `plotOverrides` in load JSON + `setPlotOverrides` host method |
| `packages/host-quickjs/src/protocol.ts` | Modify | `plotOverrides?` on `load` arm + new `setPlotOverrides` arm |
| `packages/host-quickjs/src/types.ts` | Modify | `ScriptHost.setPlotOverrides` |
| `packages/host-quickjs/src/dispatcherCore.ts` | Modify | Thread `plotOverrides` (lines 218-230); add `setPlotOverrides` dispatch case |
| `packages/host-quickjs/src/dispatcher.ts` | Modify | Wire the new entry point through if it lists handlers explicitly |
| `packages/host-quickjs/src/createQuickJsHost.test.ts` | Modify | Load-frame + setPlotOverrides tests (mirror worker shape) |
| `packages/host-quickjs/src/sandbox.test.ts` | Modify | Sandbox-escape coverage for the new wire surface |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime -F @invinite-org/chartlang-host-worker -F @invinite-org/chartlang-host-quickjs test` (coverage 100%)
- `pnpm docs:check`

## Changeset

`.changeset/plot-overrides-3-runtime-host.md` — `minor` for
`@invinite-org/chartlang-runtime`, `@invinite-org/chartlang-host-worker`,
`@invinite-org/chartlang-host-quickjs`. Additive: no override supplied ⇒
byte-identical emissions; new `setPlotOverrides` method + frame are new
surface, not a change to existing ones.

## Acceptance Criteria

- Mount-resolved `plotOverrides` apply at emit time: a hidden slot emits
  `visible: false`; a recolored slot emits the override `color`; a line
  slot picks up override `lineWidth` / `lineStyle`.
- Width/style override on a non-line kind is a silent no-op.
- `setPlotOverrides` swaps the map live; the next `drain` reflects it
  with no recompile and no extra `compute` invocation between swap and
  drain.
- Both hosts forward `plotOverrides` on `load` and relay
  `setPlotOverrides`; cross-host emissions are byte-identical for a fixed
  override set.
- Empty / absent overrides ⇒ emissions byte-identical to the
  pre-feature baseline.
- `applyPlotOverride` is exported from
  `packages/runtime/src/index.ts` with `@since` + `@stable` +
  executable `@example` (executor-safe — the docs-check tool runs every
  `@example` body).
- All touched packages at 100% coverage; `pnpm docs:check` green.
- New host-quickjs `setPlotOverrides` wire is covered by a
  sandbox-escape assertion (`sandbox.test.ts`).
- Changesets `.changeset/plot-overrides-3-runtime-host.md` committed
  (`minor` for `@invinite-org/chartlang-runtime`,
  `@invinite-org/chartlang-host-worker`,
  `@invinite-org/chartlang-host-quickjs`).
