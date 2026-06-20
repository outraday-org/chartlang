# Plan — Task 7: uPlot adapter scaffold + series / candles / panes

## Context

Implement `examples/uplot-adapter/` (private `chartlang-example-uplot-adapter`)
EXCEPT drawings (Task 8). Maps chartlang candles + plots + hlines onto uPlot
series + a custom candlestick path builder, with sub-panes handled as stacked
uPlot instances keyed by `PlotEmission.pane`. Structural template is
`examples/canvas2d-adapter/src/`. Shared geometry/mock consumed only through the
public `@invinite-org/chartlang-adapter-kit` (and `/canvas`) boundary.

## Pre-existing work (done by orchestrator — do NOT redo)

- Package scaffolded (six-file §22.4 template present), registered in
  `pnpm-workspace.yaml`, `package.json` has deps (adapter-kit + host-worker
  `workspace:^`, `uplot ^1`; devDeps compiler/core/runtime + `@types/node`),
  `pnpm install` run. uPlot resolved at `1.6.32` with bundled `uPlot.d.ts`.
- `vitest.config.ts` already matches canvas2d exactly (100% thresholds; excludes
  `*.test.ts`, `__fixtures__`, `index.ts`, `types.ts`).

## Validated references

- `@invinite-org/chartlang-adapter-kit`: `defineAdapter`, `validateEmission`,
  `capabilities` builders (`allPhase5Plots`, `allPhase3Drawings`, `alerts`,
  `intervals`, `multiTimeframe`, `subPanes`, `symInfoFields`,
  `maxDrawingsPerScript`, `alertConditions`, `logs`, `union`), `timeToX`,
  `priceToY`, `Viewport`, and all emission types (`PlotEmission`, `PlotStyle`,
  `DrawingEmission`, `RunnerEmissions`, `CandleEvent`, `Adapter`,
  `Capabilities`, `AdapterSymInfo`). CONFIRMED in `src/index.ts`.
- `@invinite-org/chartlang-adapter-kit/canvas`: `MockCanvasContext`,
  `hashCallLog`, `RenderCtx`, `RecordedCall`. CONFIRMED in `src/canvas/index.ts`
  + `package.json#exports["./canvas"]`.
- `@invinite-org/chartlang-host-worker`: `ScriptHost`, `WorkerLike`,
  `createWorkerHost`. CONFIRMED.
- `@invinite-org/chartlang-core`: `Bar`, `LineStyle` (`solid|dashed|dotted`),
  `Color` (`string`). CONFIRMED.
- uPlot surface (`uPlot.d.ts`, v1.6.32): `constructor(opts, data?, targ?)`,
  `setData(data, resetScales?)`, `setScale(key,{min,max})`, `destroy()`,
  `valToPos(val, scaleKey, canvasPixels?)`, `ctx`, `bbox`, `hooks.draw`,
  `Series.paths` builder (`(self,seriesIdx,idx0,idx1) => Paths|null`),
  `uPlot.paths.stepped` / `.bars`, `AlignedData = [xValues, ...yValues]`,
  `Series.fill`, `Band`, `Scale`. CONFIRMED.

## Architecture decisions (per task + validated)

1. **Sub-panes → stacked uPlot instances** keyed by `PlotEmission.pane`,
   ordered with `"overlay"` always first (mirrors canvas2d `paneOrder`). One
   `uPlot` per pane sharing the x scale (`time`). Documented in CLAUDE.md.
2. **Candles → custom series with a ported `paths` draw fn** (`candlePaths.ts`,
   ported from uPlot's official candlestick demo path builder; pure on a passed
   drawing API, no DOM). Lives only in the overlay pane.
3. **Plots → native uPlot series, one per `${pane}|${slotId}`.**
   `line`/`step-line` via `paths` (`step-line` ⇒ `uPlot.paths.stepped`);
   `area` via `series.fill` + line `paths`; `histogram`/`filled-band` via a
   `bars`/band paths builder + `fill`. NaN/`null` plot values ⇒ uPlot `null`
   gap. Step vs line selected per `PlotStyle.kind`.
4. **Horizontal lines + override/style kinds → `hooks.draw` ctx pass** using
   `u.valToPos`, painting to the canvas sink (`MockCanvasContext` in tests, real
   `u.ctx` in prod). THIS hook is the seam Task 8 extends for drawings — Task 7
   buffers `drawings` into state but does not render them. Override/style kinds
   (`candle-override`, `bar-override`, `bg-color`, `bar-color`,
   `horizontal-histogram`) are declared in Capabilities and mapped in the draw
   hook (per-point colour / bars) or documented no-op — never silently dropped.
5. **Test seam**: `createUplotAdapter(opts)` accepts `opts.uplotFactory?`
   (`(opts, data, target) => UplotLike`) + `opts.ctx?` (the draw-hook
   `RenderCtx`). Default `uplotFactory` constructs real `uPlot` — the single
   DOM-only constructor line carries a narrow `/* v8 ignore */` (precedent:
   canvas2d `createCanvas2dAdapter.ts:606/619`, adapter-kit
   `validateEmission.ts:441`). Everything else runs through the injected mock.
6. **`UplotLike`** structural type (the subset the factory calls: `setData`,
   `setScale`, `destroy`, `hooks`, `valToPos`, `ctx`) keeps the factory testable
   without DOM and keeps `uplot` a type-only / value-only-in-default import.

## Issues / improvements found

- No duplicate code introduced: candle path math is the ONLY ported logic;
  projection reuses adapter-kit `timeToX`/`priceToY`; mock/hash reuse
  adapter-kit `/canvas`. No cross-import of any sibling example `src/`.
- streamPump (MTF) is NOT in Task 7 scope (task says single `candleSource`);
  omitted to keep the diff minimal. Capabilities still declares
  `multiTimeframe(true)` to match canvas2d's conformance surface.

## Steps

1. `src/capabilities.ts` (+ `.test.ts`) — `UPLOT_CAPABILITIES` /
   `UPLOT_SYM_INFO`. Full surface = same set as canvas2d via builders + `union`
   (`new Set(capabilities.allPhase5Plots())` for plots;
   `union(allPhase3Drawings(), new Set(["table"]))` for drawings; alerts
   `"log"`/`"toast"`; intervals, multiTimeframe(true), subPanes(MAX_SAFE),
   symInfoFields(all 9), maxDrawingsPerScript, alertConditions(true),
   logs(true)). Frozen. JSDoc `@since`/`@stable`/`@example`.
2. `src/candlePaths.ts` (+ `.test.ts`) — pure `buildCandlePath(api, candles,
   project)` returning the canonical ctx call sequence for the candlestick body
   + wicks (ported from uPlot candlestick demo; provenance NOTE comment — this
   is a demo port, not an `../invinite/` port, so no 4-line relicense header is
   required, but a one-line attribution comment is added). Pure on a passed
   `RenderCtx` + projected points. 100% covered by direct unit test
   (bull/bear/doji, empty, NaN gap).
3. `src/defaultAdapter.ts` (+ `.test.ts`) — frozen headless `DEFAULT_ADAPTER`
   (`id`/`name`/`capabilities`/`symInfo` + no-op `candles`/`onEmissions`/
   `dispose`/`resolveInputs`), mirroring canvas2d. Package `default` export.
4. `src/createUplotAdapter.ts` (+ `.test.ts`) — factory:
   `CreateUplotAdapterOpts`, `UplotAdapterHandle = Adapter & { host: ScriptHost }`,
   `UplotLike`, module-local `WeakMap` state (bars, paneOrder, per-pane
   series/style maps, hlines, drawings buffer, alerts/logs). `ingest` validates
   via `validateEmission`; builds per-pane uPlot instances lazily; `setData` on
   each frame; hlines + overrides painted in `hooks.draw` via `valToPos` to the
   ctx sink; `dispose` calls `destroy()` per instance + `host.dispose()`.
   `runUplotLoop(handle, opts?)` drives the candle source (mirrors
   `runRendererLoop`, with the `setTimeout(0)` yield + abort signal).
5. `src/testing.ts` (+ `.test.ts`) — `MockUplot` implementing `UplotLike`:
   records `{ kind: "new", opts, data, target }`, `setData`, `setScale`,
   `destroy`; exposes `valToPos` (stubbed from the recorded opts scales) and a
   `ctx` (an injected `MockCanvasContext`); a `runDrawHooks()` helper to invoke
   `hooks.draw`. `makeUplotFactory(records, ctx)` returns the `uplotFactory`
   seam. Re-uses `hashCallLog` from `/canvas` for the ctx draw assertions.
   Exposed via `./testing` sub-path (add to `package.json#exports`).
6. `src/index.ts` — barrel: re-export factory + loop + opts/handle types +
   `UPLOT_CAPABILITIES`/`UPLOT_SYM_INFO` + `DEFAULT_ADAPTER`; `export default
   DEFAULT_ADAPTER`. `index.test.ts` asserts the surface.
7. `examples/uplot-adapter/CLAUDE.md` — invariants: stacked-instance panes
   keyed by `pane` (overlay first); native-series mapping per PlotStyle;
   draw-hook ctx seam for hlines (extended in Task 8 for drawings);
   default-export-is-capabilities-only; drawings deferred / buffered;
   `MockUplot` + `./testing` sub-path; `/* v8 ignore */` on the DOM-only
   real-uPlot constructor.
8. `package.json` — add `"./testing"` to `exports` (mirrors canvas2d). No new
   deps expected; if uPlot needs a `@types` shim, it ships its own `.d.ts`
   (CONFIRMED) so none needed.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/capabilities.ts` | Create | `UPLOT_CAPABILITIES` / `UPLOT_SYM_INFO` |
| `src/capabilities.test.ts` | Create | full-surface assertions |
| `src/candlePaths.ts` | Create | ported candlestick path builder |
| `src/candlePaths.test.ts` | Create | bull/bear/doji/empty/NaN |
| `src/defaultAdapter.ts` | Create | headless conformance export |
| `src/defaultAdapter.test.ts` | Create | no-op surface |
| `src/createUplotAdapter.ts` | Create | candles/plots/panes/hlines factory + loop |
| `src/createUplotAdapter.test.ts` | Create | mock-driven hashed integration |
| `src/testing.ts` | Create | `MockUplot` + factory seam |
| `src/testing.test.ts` | Create | mock record coverage |
| `src/index.ts` | Modify | barrel + default |
| `src/index.test.ts` | Modify | surface assertions |
| `package.json` | Modify | add `./testing` export |
| `CLAUDE.md` | Create | adapter invariants |

## Gates

- `pnpm --filter chartlang-example-uplot-adapter test` (100% coverage)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm readme:check`

## Acceptance checklist

- [ ] Default export passes conformance (capabilities-only).
- [ ] Candles + each plot kind + hlines + multi-pane render via uPlot, verified
      by `MockUplot` + `MockCanvasContext` hashed tests.
- [ ] 100% line/statement/branch/function coverage.
- [ ] README ≤ 100 lines; JSDoc `@since`/`@stable`/`@example` on every export.
- [ ] Override/style plot kinds mapped or documented-no-op, not dropped.
- [ ] Drawings deferred to Task 8; draw-hook seam established; drawings buffered.
- [ ] MIT header on every new `.ts`; no `any` / `!` / bad `as`; `import type`.
- [ ] No cross-example `src/` import; shared code via public boundary only.
- [ ] CLAUDE.md documents the invariants.
