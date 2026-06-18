# Configurable chart adapter slot + ChartPane

> **Status: TODO**

## Goal

Add the chart-rendering half of the workspace: a **single swappable
adapter module** (`src/lib/chart/activeAdapter.ts`, default
**echarts**) that the installer rewrites for the chosen library, and a
`ChartPane` React component that loads a compiled artifact into the
adapter's worker host, feeds it the symbol's `Bar[]`, renders the chart,
and surfaces alerts. This is the port of `apps/site`'s `ChartPane`
generalised over any adapter.

## Prerequisites

- Task 2 (the compile route produces `{ moduleSource, manifest,
  diagnostics }`).
- Assumes multi-library-adapters is implemented:
  `chartlang-example-echarts-adapter` (+ the other four) exist with
  `createXAdapter({ … }): Adapter & { host: ScriptHost }`.

## Current Behavior

`apps/react-starter`'s index route shows a "Chart" placeholder (Task 1).
`apps/site/ChartPane.tsx` does the real thing for canvas2d with
synthetic bars.

## Desired Behavior

The right pane renders a live chart for the compiled script + the
selected symbol's real bars, using whichever adapter the project is
configured with (echarts by default). Switching the adapter is a
one-module edit the installer automates.

## Requirements

### 1. The swappable adapter module — `src/lib/chart/activeAdapter.ts`

The **only** place a concrete adapter is named. Everything else imports
the abstract handle from here:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
//
// ACTIVE CHART ADAPTER — the single point the create-chartlang installer
// rewrites for the chosen library (default: echarts). Do not import a
// concrete chartlang-example-*-adapter anywhere else.
import {
    createEChartsAdapter,
    type EChartsAdapterHandle,
} from "chartlang-example-echarts-adapter";

export type ActiveAdapterHandle = EChartsAdapterHandle; // Adapter & { host: ScriptHost }

export type CreateAdapterOpts = {
    container: HTMLElement;          // adapters take a canvas OR a DOM node
    candleSource: AsyncIterable<CandleEvent>;
    interval?: string;
    onAlert?: (a: AlertEmission) => void;
};

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
    return createEChartsAdapter(/* map opts → echarts factory args */);
}

export const ACTIVE_ADAPTER_ID = "echarts";
```

- Normalise the per-library factory differences (canvas2d/uplot/LC take
  a `<canvas>`; echarts/konva take a DOM container) behind
  `CreateAdapterOpts` + `createActiveAdapter`, so `ChartPane` is
  adapter-agnostic. Document the contract the installer's rewrite must
  satisfy for each of the 5 libraries.
- The in-repo default depends on `chartlang-example-echarts-adapter`
  (`workspace:*`) so the app runs + e2e-tests inside the monorepo.

### 2. `ChartPane` — `src/components/workspace/ChartPane.tsx`

Port `apps/site/src/components/demo/ChartPane.tsx`, generalised:

- Props: `{ bars: ReadonlyArray<Bar>; artifact: { moduleSource: string;
  manifest: ScriptManifest } | null; onAlert; }`. (There is no type
  literally named `CompiledArtifact`; the host-loadable artifact is the
  `{ moduleSource, manifest }` subset of the compiler's `CompiledScript`
  from `@invinite-org/chartlang-compiler` — the same pair the route's
  `handleCompile` returns and `host.load()` accepts.) Drop the site's
  Play/random-walk simulator, or keep an optional "replay" toggle — see §3.
- On `artifact`/`bars` change: dispose the previous adapter, create a
  fresh one via `createActiveAdapter`, `await handle.host.load(...)` the
  compiled module, build a candle source from `bars`, run the render
  loop. Reuse the **push-candle source** + **MTF** path:
  read `(manifest as ScriptManifest).requestedIntervals`; when non-empty,
  resample via a ported `buildSecondaryStreams` +
  `createMultiStreamCandlePump`; else the plain single-source path.
- **Seam discipline — port the stream/render plumbing, do not import it
  from a concrete adapter.** In `apps/site` the `ChartPane` imports
  `runRendererLoop`, `createMultiStreamCandlePump`, and the push-candle
  source from `chartlang-example-canvas2d-adapter`. The
  multi-library-adapters design keeps these **per-adapter** (canvas2d
  retains them; the echarts adapter is **not** specified to export
  `runRendererLoop`/`createMultiStreamCandlePump` — see
  `tasks/multi-library-adapters/13-...` §7 "ported per adapter as
  needed"). Importing them from canvas2d would name a concrete
  `chartlang-example-*-adapter` and break this task's own seam rule.
  Therefore: **port the push-candle source + `createMultiStreamCandlePump`
  into a local `src/components/workspace/streamPump.ts`** (alongside the
  ported `secondaryStreams.ts`), and drive rendering through the generic
  `ActiveAdapterHandle` (`Adapter & { host }`) surface — the host emits,
  the active adapter renders — rather than a canvas2d-specific
  `runRendererLoop`. Document in the `activeAdapter` contract what render
  entry point each of the 5 libraries exposes (canvas2d/uplot/LC paint a
  frame loop; echarts/konva re-`setOption`/redraw on host emission).
- Use `bars[0].interval` for the adapter `interval` (real data is
  `"1D"`).
- Mount target: a `<div ref>` (echarts/konva) or `<canvas ref>` —
  expose whichever the active adapter needs via `activeAdapter`'s
  contract (default: a `<div>` container for echarts).

### 3. Static vs replay (decision)

- **Default static:** push the full history as one batch and render —
  real EOD history, no simulation.
- Optionally keep a small "replay" control that re-streams the loaded
  history bar-by-bar for visual effect (no random-walk fabrication —
  unlike the site demo, the starter has real data). If included, gate
  live-only alerts the same way the site does (`bar >= historyLength`).
  Keep it minimal; static is the acceptance baseline.

### 4. Alerts feed

Surface `onAlert` emissions into a sonner toast + a small alerts list in
the pane footer. (Wiring to the editor status bar lands in Task 6.)

### Edge cases

- **No artifact / empty bars** → empty-state ("compile a script" /
  "pick a symbol"), no adapter spun up.
- **Adapter teardown mid-stream** → `AbortController` into the render
  loop (mirror the site) so a new artifact/symbol cancels cleanly
  without throwing through a disposed adapter/host.
- **Container vs canvas mismatch** → the `activeAdapter` contract is the
  single seam; document the per-library mount requirement so the
  installer rewrite stays correct.
- **MTF script with real daily data** → resample daily into the
  requested higher intervals (weekly/monthly) — note daily is the finest
  the free tier offers, so sub-daily requested intervals yield NaN
  (document it).

### Test (e2e)

`tests/chart.spec.ts` — compile the seed script, load a (mocked) symbol,
assert the chart container renders (canvas/svg/echarts node present) and
that an alert-emitting script surfaces a toast. Headless adapter render
assertions stay light (the heavy adapter conformance lives in
multi-library-adapters).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/lib/chart/activeAdapter.ts` | Create | swappable adapter seam (default echarts) |
| `apps/react-starter/src/components/workspace/ChartPane.tsx` | Create | host-load + render + alerts |
| `apps/react-starter/src/components/workspace/secondaryStreams.ts` | Create | ported MTF resample |
| `apps/react-starter/src/components/workspace/streamPump.ts` | Create | ported push-candle source + `createMultiStreamCandlePump` (kept local so no concrete adapter is named) |
| `apps/react-starter/package.json` | Modify | `chartlang-example-echarts-adapter`, `@invinite-org/chartlang-adapter-kit`, `@invinite-org/chartlang-core` deps |
| `apps/react-starter/tests/chart.spec.ts` | Create | chart render e2e |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build`
- `pnpm --filter chartlang-react-starter e2e` (chart render)
- No coverage/changeset gate (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- The chart renders a compiled script over real daily bars using the
  echarts adapter by default, through the single `activeAdapter` seam.
- The seam fully isolates the concrete adapter (no other file names a
  `chartlang-example-*-adapter`), and its contract documents what the
  installer must rewrite for each of the 5 libraries.
- MTF scripts route through the multi-stream pump; alerts surface as
  toasts; teardown is clean on artifact/symbol change.
</content>
