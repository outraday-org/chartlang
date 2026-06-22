# Task 3 — ChartPane onto the driver layer

> **Status: TODO**

## Goal

Refactor `ChartPane.tsx` from its hardcoded canvas2d + `<canvas>` path
onto the Task 2 driver layer: render a generic container `<div>`, accept
an `adapterId` prop, and mount the **selected** driver into the
container — preserving every existing behaviour (static history, Play
streaming, MTF resampling, live-only alert filtering, clean dispose). No
switcher UI yet; the prop is supplied by `DemoBody` in Task 4.

## Prerequisites

Task 2 (driver layer + site deps).

## Current Behavior

`ChartPane.tsx` statically imports `createCanvas2dAdapter` +
`runRendererLoop`, renders a fixed `<canvas ref>` (800×480), and in its
main effect: disposes the previous adapter, builds a
`createPushCandleSource(bars)`, wraps it in `createResamplingCandlePump`
when `manifest.requestedIntervals` is non-empty, creates the canvas2d
adapter with `interval: bars[0].interval` + an `onAlert` that forwards
only `alert.bar >= historyLength`, loads the compiled module, and runs
`runRendererLoop(adapter, { signal })`. Play generates
`PLAY_TOTAL_BARS` random-walk bars via `nextRandomBar`, paced over
`PLAY_DURATION_MS`. Cleanup aborts the controller, ends the push source,
disposes the adapter.

## Desired Behavior

The same effect, but adapter-agnostic: it resolves the driver for
`props.adapterId` from `DEMO_ADAPTERS`, `await`s
`factory(containerEl, { candleSource, interval, width, height, onAlert })`,
loads the module via `driver.host.load(...)`, and runs
`driver.run(controller.signal)`. Changing `adapterId` re-mounts. While a
driver's lib is importing, a "loading…" affordance shows.

## Requirements

### 1. Props

```ts
export type ChartPaneProps = Readonly<{
    bars: ReadonlyArray<Bar>;
    artifact: CompiledArtifact | null;
    adapterId: string;            // NEW
    onAlert: (alert: AlertEmission) => void;
    onPlayStart: () => void;
}>;
```

### 2. Surface

- Replace the `<canvas ref>` with `<div className="chart-surface" ref>`
  sized to `CANVAS_WIDTH` × `CANVAS_HEIGHT` (keep the constants). The
  driver creates the actual canvas/svg/stage inside it (Task 2).
- The canvas2d driver (Task 2) creates its inner `<canvas>` with
  `className="chart-canvas"`, so the existing `landing.spec.ts`
  (`demo.locator("canvas.chart-canvas")` + bitmap read) keeps passing
  after this swap — do not drop that class.
- Add `.chart-surface { width: 800px; height: 480px; position:
  relative; }` (or the existing canvas sizing) to `demo.css`. Keep the
  rendered pixel size identical to today so layout is unchanged.

### 3. Effect refactor

- Keep `createPushCandleSource`, `nextRandomBar`,
  `createResamplingCandlePump`, the `requestedIntervals` branch, the
  `historyLength`/`intervalMs`/`mainInterval` computation, and the Play
  pacing loop **byte-for-byte** in behaviour.
- Replace the adapter creation block with:

  ```ts
  const descriptor = DEMO_ADAPTERS.find((a) => a.id === adapterId)
      ?? DEMO_ADAPTERS[0];
  const factory = await descriptor.load();
  if (controller.signal.aborted) return;
  const driver = await factory(container, {
      candleSource,
      ...(mainInterval !== undefined ? { interval: mainInterval } : {}),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      onAlert: (alert) => {
          if (alert.bar >= historyLength) onAlertRef.current(alert);
      },
  });
  if (controller.signal.aborted) { driver.dispose(); return; }
  driverRef.current = driver;
  await driver.host.load({
      moduleSource: artifact.moduleSource,
      manifest: artifact.manifest as ScriptManifest,
  });
  if (controller.signal.aborted) return;
  if (pendingPlayRef.current) { pendingPlayRef.current = false; beginStream(); }
  await driver.run(controller.signal);
  ```

- The whole `start()` body is now `async` over the driver `load()`. The
  factory + load are both async; guard each `await` boundary with
  `controller.signal.aborted` (a new artifact/adapter mid-import must not
  mount a stale driver). The existing `try/catch` that swallows errors
  when `signal.aborted` stays.
- Rename `adapterRef`/`AdapterHandle` to `driverRef: useRef<
  DemoAdapterDriver | null>`. Cleanup + the unmount effect call
  `driverRef.current?.dispose()`.
- **Add `adapterId` to the main effect dependency array**
  (`[artifact, bars, adapterId, playRun]`) so switching adapters
  re-runs the mount. Confirm switching does NOT spuriously trigger a
  Play run (it should land in "static history").

### 4. Loading affordance

- Add `const [loadingLib, setLoadingLib] = useState(false)`. Set it
  `true` before `descriptor.load()` and `false` once the driver is
  mounted (or on abort/cleanup). Show it in the existing `.chart-mode`
  span, e.g. `loadingLib ? "loading renderer…" : playing ? … : "static
  history"`. This covers the brief first-time lazy import of a heavy lib.

### 5. Preserve invariants (from `apps/CLAUDE.md`)

- Demo input bars carry **no `point` method** — `nextRandomBar` keeps
  building plain serialisable bars cast to `Bar`. Do not add `point`.
- The MTF resampling-on-the-live-source path stays exactly as is; only
  the adapter creation/run is swapped.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/demo/ChartPane.tsx` | Modify | `adapterId` prop, container surface, driver mount/run/dispose, loading state |
| `apps/site/src/components/demo/demo.css` | Modify | `.chart-surface` sizing (replaces `.chart-canvas` if needed) |

## Gates

- `pnpm --filter chartlang-site typecheck`
- `pnpm --filter chartlang-site build`
- Manual / dev check: `pnpm --filter chartlang-site dev`, open `#demo`,
  confirm canvas2d still renders + Plays identically (full e2e proof
  lands in Task 4).

## Changeset

None (`apps/site` private).

## Acceptance Criteria

- `ChartPane` takes `adapterId` and mounts the matching driver; with
  `adapterId="canvas2d"` the demo behaves exactly as before (static
  render, Play streaming, MTF weekly line, live-only alerts).
- Switching the `adapterId` prop re-mounts cleanly with no orphan
  surface and no console errors.
- Every `await` boundary is abort-guarded; a mid-import artifact/adapter
  change does not mount a stale driver.
- `typecheck` + `build` green; `point`-less bars + live MTF resampling
  preserved.
