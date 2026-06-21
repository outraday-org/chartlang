# Task 2 — Demo adapter driver layer + site deps

> **Status: TODO**

## Goal

Introduce a site-side driver layer that normalises the five example
adapters' divergent live-render factories behind one
`DemoAdapterDriver` contract, with each driver **dynamic-importing** its
adapter package (and peer lib) so the heavy libs become lazy per-adapter
chunks that never enter the SSR graph. Add the four library adapters +
four peer libs + `host-worker` to `apps/site/package.json`. No UI and no
`ChartPane` change yet — this task delivers the abstraction the next two
consume.

## Prerequisites

Task 1 — konva live-mount (`container` option + `runKonvaLoop`), so the
konva driver can mount and drive like the other four.

## Current Behavior

`apps/site` depends only on `chartlang-example-canvas2d-adapter`.
`ChartPane.tsx` statically imports `createCanvas2dAdapter` +
`runRendererLoop` and there is no abstraction over the other four
adapters. The conformance runner drives only the headless
`DEFAULT_ADAPTER` (capabilities-only), so it is **not** reusable for live
rendering.

## Desired Behavior

A new `apps/site/src/components/demo/adapters/` folder exports:

- a `DemoAdapterDriver` contract and a `DemoAdapterFactory` type,
- a `DEMO_ADAPTERS` registry of `{ id, label, load }` entries (lazy),
- one driver module per adapter that adapts its factory to the contract.

`apps/site/package.json` gains the four library adapter workspace
packages, their peer libs, and `@invinite-org/chartlang-host-worker`
(for the `ScriptHost` type the driver contract imports).

## Requirements

### 1. Dependencies (`apps/site/package.json`)

Add to `dependencies` (alphabetised with the existing entries):

```jsonc
"@invinite-org/chartlang-host-worker": "workspace:*",
"chartlang-example-echarts-adapter": "workspace:*",
"chartlang-example-konva-adapter": "workspace:*",
"chartlang-example-lightweight-charts-adapter": "workspace:*",
"chartlang-example-uplot-adapter": "workspace:*",
"echarts": "^5",
"konva": "^9",
"lightweight-charts": "^5",
"uplot": "^1"
```

Library ranges match `scripts/adapters/registry.ts` `libraryRange`.
`@invinite-org/chartlang-host-worker` is added because the driver
contract (`adapters/types.ts`) imports the `ScriptHost` **type** from it
(it is exported from neither `chartlang-adapter-kit` nor
`chartlang-core`); in this pnpm workspace a transitive dep is not
resolvable from `apps/site` without a direct entry. Run `pnpm install`
so the workspace links resolve. Do **not** add the libs to
`optimizeDeps.exclude` or import them statically anywhere.

### 2. Driver contract — `adapters/types.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptHost } from "@invinite-org/chartlang-host-worker";

/** What the driver needs to stand up one live renderer in `mountEl`. */
export type DriverMountOpts = Readonly<{
    candleSource: AsyncIterable<CandleEvent>;
    interval?: string;
    width: number;
    height: number;
    onAlert?: (alert: AlertEmission) => void;
}>;

/**
 * A live, mounted adapter normalised across the five example libraries.
 * `host.load(...)` feeds the compiled module; `run(signal)` drives the
 * render loop until `signal` aborts; `dispose()` tears down the renderer
 * + worker AND empties the mount element.
 */
export type DemoAdapterDriver = Readonly<{
    host: ScriptHost;
    run: (signal: AbortSignal) => Promise<void>;
    dispose: () => void;
}>;

/** Mounts one adapter into `mountEl`. Async: drivers dynamic-import. */
export type DemoAdapterFactory = (
    mountEl: HTMLElement,
    opts: DriverMountOpts,
) => Promise<DemoAdapterDriver>;
```

`ScriptHost` is exported from `@invinite-org/chartlang-host-worker`
(verified — the example adapters import it from there; it is **not**
re-exported by `chartlang-adapter-kit` or `chartlang-core`). That is why
Requirement 1 adds `host-worker` to `apps/site` dependencies.

### 3. Registry — `adapters/registry.ts`

```ts
export type DemoAdapterDescriptor = Readonly<{
    id: string;
    label: string;
    load: () => Promise<DemoAdapterFactory>;
}>;

export const DEMO_ADAPTERS: ReadonlyArray<DemoAdapterDescriptor> = [
    { id: "canvas2d",          label: "Canvas 2D",          load: () => import("./canvas2d").then((m) => m.default) },
    { id: "lightweight-charts", label: "Lightweight Charts", load: () => import("./lightweightCharts").then((m) => m.default) },
    { id: "uplot",             label: "uPlot",              load: () => import("./uplot").then((m) => m.default) },
    { id: "echarts",           label: "ECharts",            load: () => import("./echarts").then((m) => m.default) },
    { id: "konva",             label: "Konva",              load: () => import("./konva").then((m) => m.default) },
];

export const DEFAULT_ADAPTER_ID = "canvas2d";

export function isDemoAdapterId(id: string): boolean {
    return DEMO_ADAPTERS.some((a) => a.id === id);
}
```

> **Maintenance note (put it in a comment here AND mention it in the PR
> description):** these `id`s are mirrored from
> `scripts/adapters/registry.ts` `ADAPTERS[].id`, the SSOT the docs
> gallery + `add-adapter` CLI read. Adding/removing an adapter means
> updating **both** lists.

### 4. Driver modules (one per adapter, `default`-exporting a `DemoAdapterFactory`)

Each driver dynamic-imports its package inside the factory body, builds
the surface inside `mountEl`, wires the factory + run loop, and returns
the `{ host, run, dispose }` triple. Exact wiring per the verified
signatures:

- **`canvas2d.ts`** — creates a `<canvas class="chart-canvas" width
  height>` child of `mountEl`. **Keep the `chart-canvas` class** — the
  existing `landing.spec.ts` targets `demo.locator("canvas.chart-canvas")`
  and reads its bitmap, so preserving the class keeps that spec green
  after Task 3 swaps ChartPane's `<canvas>` for a container `<div>` (see
  Task 4). `createCanvas2dAdapter({ canvas, candleSource, interval?,
  onAlert? })`; `run = (signal) => runRendererLoop(adapter, { signal })`;
  `dispose` calls `adapter.dispose()` then clears `mountEl`.
- **`lightweightCharts.ts`** — `createLightweightChartsAdapter({
  container: mountEl, candleSource, ... })` (it imports
  `lightweight-charts` internally via its default `createChart`);
  run loop is its `runRendererLoop` export.
- **`uplot.ts`** — `createUplotAdapter({ target: mountEl, width, height,
  candleSource, onAlert? })` (imports `uplot` internally); run loop is
  `runUplotLoop(handle, { signal })`.
- **`echarts.ts`** — dynamic-import `echarts`, then
  `createEChartsAdapter({ echartsFactory: () => echarts.init(mountEl),
  candleSource, onAlert? })`; run loop `runEChartsLoop(handle, { signal })`.
- **`konva.ts`** — dynamic-import `konva` (the namespace) **and** the
  adapter; `createKonvaAdapter({ konva, container: mountEl, stage: {
  width, height }, candleSource, interval? })`. The `container` option
  and the `runKonvaLoop` export both land in **Task 1**, so konva is now
  uniform with the other four: Konva attaches its content `<div>` to
  `mountEl` via `container`, and `run = (signal) => runKonvaLoop(handle,
  { signal })` drives `candleSource` (feed + push + drain) with
  abort-guarding. (Without Task 1, the published konva adapter builds its
  `Stage` with no container and exposes no run loop — it cannot mount
  live.) `dispose` calls `handle.dispose()` then clears `mountEl`.

Normalisation rule for every driver:

- `run` must reject/return cleanly when `signal` is already aborted, and
  stop pumping when it aborts mid-stream (mirror canvas2d's existing
  `runRendererLoop({ signal })` contract).
- `dispose` must be idempotent and must empty `mountEl`
  (`mountEl.replaceChildren()`) so switching adapters leaves no orphan
  canvas/svg/stage behind.
- Surface the underlying handle's `.host` as `host`. All five
  `*AdapterHandle`s expose `.host: ScriptHost` (verified), so each driver
  returns `{ host: handle.host, run, dispose }`.

Add the MIT header to every new `.ts` file (`apps/CLAUDE.md` rule).

### 5. SSR / bundling guard

- Never statically import any of `echarts`/`konva`/`lightweight-charts`/
  `uplot` or the four adapter packages outside the driver modules.
- The driver modules are reached only through the client-only, lazy
  `DemoBody` → `ChartPane` path, and each does its `import()` at call
  time, so they stay out of the `ssr` build. After implementing, run
  `pnpm --filter chartlang-site build` and confirm the build succeeds and
  the heavy libs land in client chunks (not `dist/server`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/package.json` | Modify | Add 4 adapter packages + 4 libs + `host-worker` (for the `ScriptHost` type) |
| `apps/site/src/components/demo/adapters/types.ts` | Create | `DemoAdapterDriver` / `DemoAdapterFactory` / `DriverMountOpts` |
| `apps/site/src/components/demo/adapters/registry.ts` | Create | `DEMO_ADAPTERS`, `DEFAULT_ADAPTER_ID`, `isDemoAdapterId` |
| `apps/site/src/components/demo/adapters/canvas2d.ts` | Create | canvas2d driver |
| `apps/site/src/components/demo/adapters/lightweightCharts.ts` | Create | lwc driver |
| `apps/site/src/components/demo/adapters/uplot.ts` | Create | uplot driver |
| `apps/site/src/components/demo/adapters/echarts.ts` | Create | echarts driver |
| `apps/site/src/components/demo/adapters/konva.ts` | Create | konva driver |

## Gates

- `pnpm --filter chartlang-site typecheck`
- `pnpm --filter chartlang-site build` (SSR + client succeed)
- `pnpm lint` (`apps/**` is Biome-ignored, so this is a no-op for the new
  files — still run it to confirm nothing else regressed)
- No `pnpm test` impact (`apps/**` is Vitest-excluded)

## Changeset

None — `apps/site` is `"private": true`; the changeset gate is
package-scoped (`apps/CLAUDE.md`).

## Acceptance Criteria

- The nine new dependencies are present and `pnpm install` resolves the
  five `workspace:*` links (four adapters + `host-worker`).
- `adapters/types.ts` + `adapters/registry.ts` + five driver modules
  exist, each with the MIT header, and `typecheck` passes.
- `DEMO_ADAPTERS` ids exactly equal the `scripts/adapters/registry.ts`
  ids; the maintenance comment is present.
- Each driver `default`-exports a `DemoAdapterFactory` that dynamic-
  imports its lib; no static import of a heavy lib exists in the demo.
- `pnpm --filter chartlang-site build` succeeds and the heavy libs are in
  client chunks, not the SSR bundle.
