# Live Demo Adapter Switcher

Wire the four library adapters (lightweight-charts, uplot, echarts,
konva) alongside the existing canvas2d reference into the `apps/site/`
live demo, behind a right-aligned dropdown in the chart toolbar so a
visitor can render **one chartlang script across five chart libraries**
— the "one script, many charts" story the docs gallery already tells in
prose (`docs/adapters/gallery.md`).

This is the follow-up that Task 15 of `tasks/multi-library-adapters/`
explicitly deferred ("All gates green; live demos explicitly deferred").
The docs surface is done; this folder finishes the *interactive* surface.

See `apps/CLAUDE.md` ("`apps/site/` demo + compiler invariants") for the
demo's hard build/runtime constraints, and `apps/site/src/components/
demo/CLAUDE.md` is not present — the demo conventions live in
`apps/CLAUDE.md`.

## Current State

- The demo (`apps/site/src/components/demo/`) is **hardcoded to
  canvas2d**: `ChartPane.tsx` statically imports
  `createCanvas2dAdapter` + `runRendererLoop` from
  `chartlang-example-canvas2d-adapter` and renders a single `<canvas>`.
- `DemoBody.tsx` has one `Select` — a **script** switcher over
  `DEMO_SCRIPTS`, with `?script=<id>` deep-linking — and no adapter
  switcher.
- `apps/site/package.json` depends only on
  `chartlang-example-canvas2d-adapter`; the other four adapter packages
  and their peer libs (`echarts`, `konva`, `lightweight-charts`,
  `uplot`) are **not** site dependencies.
- The five example adapters each ship a real renderer factory, but with
  **non-uniform signatures and mount targets** (see Architecture
  Decisions). There is no shared "create a live renderer onto a DOM
  element" abstraction — the conformance runner only drives the headless
  `DEFAULT_ADAPTER` (capabilities-only), not the live factories.
- **konva cannot be mounted live as published**: `createKonvaAdapter`
  builds its `Stage` with no `container` (and never exposes it on the
  handle) and ships **no run-loop export**. The other four mount via a
  `canvas`/`container` + a run loop. Task 1 closes this gap upstream.
- The demo is rendered at `#demo` on the landing page, exercised by
  `apps/site/tests/e2e/landing.spec.ts` (Playwright). `apps/**` is
  Biome- and Vitest-excluded; functional tests for the demo are e2e.

## Target State

- `apps/site/` depends on all five adapter workspace packages and the
  four peer libs.
- A small **driver layer** at `apps/site/src/components/demo/adapters/`
  normalises the five factories behind one `DemoAdapterDriver` contract
  (`{ host, run(signal), dispose() }`), each driver **dynamic-importing**
  its adapter package + lib so the heavy libs are lazy per-adapter chunks
  (echarts/konva are large) and never enter the SSR graph.
- `ChartPane.tsx` renders a generic container `<div>` and mounts the
  **selected** driver into it, preserving every existing behaviour
  (static history, Play streaming, MTF resampling, live-only alert
  filtering, clean dispose on change).
- `DemoBody.tsx` owns an `adapterId` state, defaults to `canvas2d`,
  preselects from `?adapter=<id>`, and renders a second `Select`
  **right-aligned in the chart toolbar** (next to Play). Selecting an
  adapter re-mounts the chart against that library; the URL param keeps
  the choice shareable/deep-linkable.
- A new Playwright spec proves each adapter renders the compiled script
  without error and that `?adapter=` round-trips.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Site-side driver layer (`DemoAdapterDriver`), not a new shared package** | The five factories diverge in signature *and* mount target — `createCanvas2dAdapter({canvas})`+`runRendererLoop`, `createLightweightChartsAdapter({container})`+`runRendererLoop`, `createUplotAdapter({target,width,height})`+`runUplotLoop`, `createEChartsAdapter({echartsFactory})`+`runEChartsLoop`, `createKonvaAdapter({konva,container,stage})`+`runKonvaLoop` (the `container` opt + `runKonvaLoop` added in Task 1). Normalising this is demo-presentation glue, not a reusable library contract, so it lives in `apps/site` — not `adapter-kit`. |
| **konva needs a small upstream change (Task 1); the other four don't** | canvas2d/lwc/uplot/echarts already mount via a `canvas`/`container` + a run loop. The published konva adapter builds its `Stage` with no `container` (never exposed on the handle) and ships no run loop, so it cannot render live. Task 1 adds an optional `container` + a `runKonvaLoop` export — additive, no changeset (the example package is private/unpublished) — keeping konva uniform with the rest. |
| **Each driver dynamic-imports its package + lib** | `echarts`/`konva`/`lightweight-charts`/`uplot` are heavy browser libs. A static import would bloat the demo's initial client chunk and risk pulling DOM-only code into the SSR build. Dynamic `import()` inside the client-only, lazy `DemoBody`→`ChartPane` path keeps them out of SSR and splits them into per-adapter chunks loaded only on selection. |
| **Generic container `<div>`, drivers own their surface** | canvas2d/uplot want a `<canvas>`/sized element; lwc/echarts/konva want a container `<div>`. ChartPane renders one empty sized `<div>` and each driver creates the surface it needs inside it, so ChartPane stays surface-agnostic. |
| **`adapterId` state in DemoBody, control rendered in ChartPane toolbar** | DemoBody owns the state so it can sync `?adapter=` (same place it owns `scriptId`/`?script=`); the `Select` renders in the chart toolbar (right-aligned by Play) per the requested UX. ChartPane receives `adapterId` + `onAdapterChange`. |
| **`canvas2d` default + `?adapter=` deep-link** | Mirrors the established `?script=` pattern (`resolveInitialScriptId`) so the demo's behaviour is unchanged for existing links and the new choice is shareable. |
| **e2e (Playwright), no unit tests** | `apps/**` is Vitest-excluded with no coverage gate; the demo's functional contract is verified by Playwright (`apps/site/tests/e2e/`). |

## Dependency Graph

```
Task 1 (konva adapter: container opt + runKonvaLoop)
  |   examples/konva-adapter — makes konva live-mountable
  v
Task 2 (driver layer + site deps)
  |   apps/site/src/components/demo/adapters/* + package.json
  v
Task 3 (ChartPane onto the driver layer)
  |   ChartPane renders a container + mounts the selected driver
  v
Task 4 (DemoBody switcher UI + ?adapter= + e2e)
      adapter Select in the chart toolbar, URL persistence, Playwright
```

## Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Make the konva adapter live-mountable](./1-konva-adapter-live-mount.md) | examples/konva-adapter | None | Medium |
| 2 | [Demo adapter driver layer + site deps](./2-demo-adapter-driver-layer.md) | apps/site | 1 | High |
| 3 | [ChartPane onto the driver layer](./3-chartpane-driver-refactor.md) | apps/site | 2 | Medium |
| 4 | [Adapter switcher UI + URL param + e2e](./4-demobody-switcher-ui-e2e.md) | apps/site | 3 | Medium |

## Code Reuse

| Existing | Path | Reuse in |
|----------|------|----------|
| canvas2d `runRendererLoop` (template) | `chartlang-example-canvas2d-adapter` (`runRendererLoop`) | model for `runKonvaLoop` (Task 1) |
| konva `feedCandleEvent` + integration drive loop | `examples/konva-adapter` (`feedCandleEvent`, `src/integration.test.ts`) | `runKonvaLoop` body (Task 1) |
| canvas2d factory + loop | `chartlang-example-canvas2d-adapter` (`createCanvas2dAdapter`, `runRendererLoop`) | canvas2d driver (Task 2) |
| lwc / uplot / echarts / konva factories + loops | `chartlang-example-{lightweight-charts,uplot,echarts,konva}-adapter` public surface | per-adapter drivers (Task 2) |
| `ScriptHost` type | `@invinite-org/chartlang-host-worker` (NOT adapter-kit/core) | `adapters/types.ts` driver contract (Task 2) |
| Adapter id SSOT | `scripts/adapters/registry.ts` `ADAPTERS[].id` (`canvas2d`,`echarts`,`konva`,`lightweight-charts`,`uplot`) | `DEMO_ADAPTERS` ids MUST match these (Task 2) |
| MTF resampling pump | `apps/site/src/components/demo/secondaryStreams.ts` (`createResamplingCandlePump`) | preserved in ChartPane (Task 3) |
| Push candle source / random-walk Play | `ChartPane.tsx` (`createPushCandleSource`, `nextRandomBar`) | preserved in ChartPane (Task 3) |
| `?script=` preselect pattern | `DemoBody.tsx` (`initialScriptId`, read-only on load) | mirror for `?adapter=` (Task 4) |
| `Select` primitive (`items` prop) | `apps/site/src/components/ui/select` | adapter Select (Task 4) |
| e2e demo interaction | `apps/site/tests/e2e/landing.spec.ts` (`#demo`, `.cm-content`, `button.play-button`, `canvas.chart-canvas`) | new adapter spec; canvas2d keeps `.chart-canvas` so this stays green (Task 4) |

## Provenance

None — no `../invinite/` ports. Tasks 2–4 are `apps/site/` glue over the
example adapters. Task 1 is a small **additive** change to
`examples/konva-adapter` (a private, unpublished package — no changeset)
so konva can mount into a live DOM element like the other four.

## Deferred / Follow-Up Work

- A capability badge per adapter in the switcher (e.g. "full surface")
  — every adapter is full-surface today, so it adds no information yet.
- Per-adapter render screenshots in the docs gallery (separate from this
  interactive switcher).
- Importing `DEMO_ADAPTERS` ids directly from
  `scripts/adapters/registry.ts` instead of mirroring them — deferred to
  avoid an app→`scripts/` bundling dependency; ids are kept in sync by
  the maintenance note in Task 1.
