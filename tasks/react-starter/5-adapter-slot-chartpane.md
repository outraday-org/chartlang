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
  manifest: ScriptManifest } | null; onAlert; }`. The host-loadable
  artifact is exactly the type `host.load()` accepts:
  **`HostCompiledScript = { moduleSource: string; manifest: ScriptManifest }`**
  (exported from `@invinite-org/chartlang-host-worker`), which is the
  `{ moduleSource, manifest }` subset of the compiler's `CompiledScript`
  (`@invinite-org/chartlang-compiler`) — the same pair the route's
  `handleCompile` returns. There is no **package-exported** type named
  `CompiledArtifact`, but the site's `hybridLanguageService.ts` (ported in
  Task 6) defines a **local** `CompiledArtifact = Readonly<{ moduleSource:
  string; manifest: unknown }>` and the site `ChartPane` imports it from
  there — mirror that: type the prop via the ported local `CompiledArtifact`
  (or inline `{ moduleSource, manifest }`), casting `manifest as
  ScriptManifest` at `host.load()` like the site does. Drop the site's
  Play/random-walk simulator, or keep an optional "replay" toggle — see §3.
- On `artifact`/`bars` change: dispose the previous adapter, create a
  fresh one via `createActiveAdapter`, `await handle.host.load(...)` the
  compiled module, build a candle source from `bars`, run the render
  loop. Reuse the **push-candle source** + **MTF** path:
  read `(manifest as ScriptManifest).requestedIntervals`; when non-empty,
  resample via the ported `createResamplingCandlePump(pushSource, intervals)`
  (the real symbol in the site's `secondaryStreams.ts` — **not**
  `buildSecondaryStreams`, which does not exist); else the plain
  single-source path. (The push source is the local `createPushCandleSource`
  ported into `streamPump.ts` — see the seam-discipline note below.)
- **Seam discipline — port the stream/render plumbing, do not import the
  concrete adapter.** In `apps/site` the `ChartPane` imports
  `createCanvas2dAdapter` **and** `runRendererLoop` from
  `chartlang-example-canvas2d-adapter` (both name a concrete adapter). The
  push-candle source (`createPushCandleSource`) is **local/inline** in the
  site `ChartPane`, and the MTF resample (`createResamplingCandlePump`) is
  **local** in `secondaryStreams.ts` — neither is imported from the adapter,
  so the site already keeps the stream plumbing seam-clean; only the
  `createCanvas2dAdapter`/`runRendererLoop` imports break the seam. The
  echarts adapter exposes its own loop (`runEChartsLoop`), and the
  multi-library-adapters design keeps the render loop **per-adapter** (see
  `tasks/multi-library-adapters/` — "ported per adapter as needed").
  Therefore for the starter: **extract the push-candle source
  (`createPushCandleSource`) into a local
  `src/components/workspace/streamPump.ts`** (alongside the ported
  `secondaryStreams.ts`'s `createResamplingCandlePump`), and drive
  rendering through the generic `ActiveAdapterHandle` (`Adapter & { host }`)
  surface — the host emits, the active adapter renders — rather than a
  canvas2d-specific `runRendererLoop`. The active adapter's render entry
  (e.g. `runEChartsLoop` for echarts) is invoked **only** through the
  `activeAdapter` seam, never imported by `ChartPane`. Document in the
  `activeAdapter` contract what render entry point each of the 5 libraries
  exposes (canvas2d/uplot/LC paint a frame loop; echarts/konva
  re-`setOption`/redraw on host emission).
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

### 5. Per-library seam SSOT (so the matrix + installer can't drift)

The per-library `activeAdapter` rewrite (import line + factory call +
mount target + render entry) must be defined **once**, as data, in
`src/lib/chart/seamVariants.ts`:

```ts
// One entry per BUNDLED_ADAPTERS id. The committed seam (activeAdapter.ts)
// is the `echarts` variant rendered from this table; the matrix test (§6)
// rewrites activeAdapter.ts to each variant; the installer's seamTemplates
// (Task 7) MUST emit byte-identical bodies to these.
export type SeamVariant = {
    id: "canvas2d" | "lightweight-charts" | "uplot" | "echarts" | "konva";
    pkg: string;                 // chartlang-example-<id>-adapter
    mount: "canvas" | "div";     // canvas2d/uplot/LC → canvas; echarts/konva → div
    seamSource: string;          // full activeAdapter.ts body for this id
};
export const SEAM_VARIANTS: ReadonlyArray<SeamVariant>;
```

This is the single source of truth Task 7's `seamTemplates.ts` mirrors —
a test there asserts the installer's emitted seam for each id is
byte-identical to `SEAM_VARIANTS[id].seamSource` (after the
`workspace:*` → published-version + local-name substitutions). The
committed `activeAdapter.ts` is the `echarts` entry verbatim.

### Test (e2e)

`tests/chart.spec.ts` — the **echarts (default)** path: compile the seed
script, load a (mocked) symbol, assert the chart container renders
(canvas/svg/echarts node present) and that an alert-emitting script
surfaces a toast. Headless adapter render assertions stay light (the
heavy adapter conformance lives in multi-library-adapters).

### Test (adapter matrix — all 5 actually render in the starter)

The whole point of the seam is library-interchange, so prove it: the
starter dev-depends on **all five** `chartlang-example-*-adapter`
(`workspace:*`, devDependencies — runtime dep stays echarts-only) so the
matrix runs inside the monorepo with zero network.

`tests/adapter-matrix.spec.ts` — parameterized over `SEAM_VARIANTS`
(`for (const v of SEAM_VARIANTS)` / Playwright `test.describe` per id):

1. Swap `src/lib/chart/activeAdapter.ts` to `v.seamSource` (write before
   the dev server boots; restore in `afterAll` — echarts is the committed
   default).
2. Compile the seed script, load the mocked symbol.
3. Assert the chart renders for that library's mount kind — `v.mount`
   `"canvas"` → a `<canvas>` with non-zero size; `"div"` → the library's
   root node (echarts `<canvas>`/`zr` root, konva `Stage` container).
4. Assert the alert toast still surfaces through the generic
   `ActiveAdapterHandle` (host emits → adapter renders) — i.e. nothing in
   the render path is echarts-specific.

A green matrix is the guarantee that **any** library the installer can
pick renders in the starter, not just the default. Keep each case a
render smoke (the deep drawing-correctness gate is adapter conformance in
multi-library-adapters — do not duplicate it here).

> If the matrix proves too heavy for Playwright per-id (5× dev-server
> boots), an acceptable lighter variant is a **build-per-variant** matrix
> (`pnpm build` with each `v.seamSource` swapped in) + a single jsdom
> render smoke per adapter — but at minimum every id must be built AND
> mounted, never only echarts.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/lib/chart/activeAdapter.ts` | Create | swappable adapter seam (default echarts) — the committed `SEAM_VARIANTS.echarts` body |
| `apps/react-starter/src/lib/chart/seamVariants.ts` | Create | `SEAM_VARIANTS` SSOT (one entry per adapter id; mirrored by Task 7's `seamTemplates.ts`) |
| `apps/react-starter/src/components/workspace/ChartPane.tsx` | Create | host-load + render + alerts |
| `apps/react-starter/src/components/workspace/secondaryStreams.ts` | Create | ported MTF resample — exports `createResamplingCandlePump` (the site's symbol; **not** `buildSecondaryStreams`) |
| `apps/react-starter/src/components/workspace/streamPump.ts` | Create | ported local push-candle source (`createPushCandleSource`, extracted from the site `ChartPane`) — kept local so no concrete `chartlang-example-*-adapter` is named |
| `apps/react-starter/package.json` | Modify | runtime dep `chartlang-example-echarts-adapter` + `@invinite-org/chartlang-adapter-kit`/`-core`; **devDeps on the other 4 `chartlang-example-*-adapter` (`workspace:*`) for the matrix test** |
| `apps/react-starter/tests/chart.spec.ts` | Create | echarts (default) chart render e2e |
| `apps/react-starter/tests/adapter-matrix.spec.ts` | Create | all-5-adapter render matrix over `SEAM_VARIANTS` |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build`
- `pnpm --filter chartlang-react-starter e2e` (chart render — includes the
  **`adapter-matrix.spec.ts` run that boots/builds + mounts all 5
  adapters**, not just echarts)
- No coverage/changeset gate (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- The chart renders a compiled script over real daily bars using the
  echarts adapter by default, through the single `activeAdapter` seam.
- The seam fully isolates the concrete adapter (no other file names a
  `chartlang-example-*-adapter` outside `seamVariants.ts`), and its
  contract documents what the installer must rewrite for each of the 5
  libraries.
- **`adapter-matrix.spec.ts` is green for all 5 ids** — every library the
  installer can pick (canvas2d, lightweight-charts, uplot, echarts, konva)
  builds and mounts a chart in the starter, proving the seam is genuinely
  interchangeable rather than echarts-only.
- `SEAM_VARIANTS` is the single seam SSOT; the committed `activeAdapter.ts`
  equals its `echarts` entry verbatim.
- MTF scripts route through the multi-stream pump; alerts surface as
  toasts; teardown is clean on artifact/symbol change.
</content>
