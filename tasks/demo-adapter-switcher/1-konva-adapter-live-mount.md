# Task 1 — Make the konva example adapter live-mountable

> **Status: TODO**

## Goal

The four other example adapters (canvas2d, lightweight-charts, uplot,
echarts) can each be mounted into a live DOM element and driven to
completion via a single run-loop call. **konva cannot, as published.**
This task closes that gap so the live switcher (Tasks 2–4) can render
all five libraries with one uniform driver shape. It is the only task
in this folder that touches a package outside `apps/site/`.

## Prerequisites

None.

## Current Behavior

`examples/konva-adapter/src/createKonvaAdapter.ts`:

- `createKonvaAdapter({ konva, stage: { width, height }, candleSource,
  ... })` builds its `Konva.Stage` with **no container**:
  `new opts.konva.Stage({ width: opts.stage.width, height:
  opts.stage.height })` (line ~861). A Konva `Stage` created without a
  `container` keeps its content `<div>` **detached** from the document,
  so nothing is visible.
- The `Stage` is stored in a module-local `HANDLE_STATE` `WeakMap`; the
  public `KonvaAdapterHandle` (`Adapter & { host: ScriptHost }`) **does
  not expose it**, so a consumer cannot reach the content div to attach
  it.
- There is **no run-loop export**. The package ships
  `feedCandleEvent(handle, event)` + `handleInterval(handle)`, and
  `src/integration.test.ts` hand-rolls the drive loop:

  ```ts
  for await (const event of adapter.candles({ interval: "1D" })) {
      feedCandleEvent(adapter, event);
      await adapter.host.push(event);
      const emissions = await adapter.host.drain();
      adapter.onEmissions(emissions);
  }
  ```

So the live demo cannot (a) attach the konva surface to its mount
element, nor (b) drive it with one call the way the other four adapters'
`runRendererLoop` / `runUplotLoop` / `runEChartsLoop` allow.

## Desired Behavior

Two additive, backward-compatible changes to `examples/konva-adapter`:

1. **Optional `container`** on `createKonvaAdapter`. When supplied, the
   `Stage` is constructed with it so Konva attaches the content div to
   the DOM. Omitted (the existing test path with `MockKonva`) behaves
   exactly as today.
2. **A `runKonvaLoop(handle, { signal })` export** that drives the
   handle to completion over its injected `candleSource`, mirroring
   canvas2d's `runRendererLoop` (abort-guarded, with the worker-host
   yield) plus konva's `feedCandleEvent` repaint. This gives the
   apps/site konva driver the same `run: (signal) => …Loop(handle,
   { signal })` shape as the other four.

No behavioural change to existing callers, the headless
`DEFAULT_ADAPTER`, the conformance default, or the pinned integration
hash.

## Requirements

### 1. `container` option (`src/createKonvaAdapter.ts` + `src/types.ts`)

- Add `readonly container?: HTMLElement;` to `CreateKonvaAdapterOpts`
  (JSDoc: production callers pass the mount element; tests omit it and
  pass `MockKonva`, whose `Stage` records config without a real DOM).
- Construct the stage conditionally so the no-container path is
  byte-identical to today:

  ```ts
  const stage = new opts.konva.Stage(
      opts.container !== undefined
          ? { container: opts.container, width: opts.stage.width, height: opts.stage.height }
          : { width: opts.stage.width, height: opts.stage.height },
  );
  ```

- Extend the structural `KonvaNamespace` Stage-config seam in
  `src/types.ts` so the `Stage` constructor's config bag accepts an
  optional `container?: HTMLElement`. `MockKonva` (`src/testing.ts`)
  must accept (and may ignore) a `container` in its `Stage` config
  without throwing — confirm its constructor records or drops the extra
  key. Do **not** add a `node-canvas` / `canvas` dependency (CLAUDE.md
  invariant); the mock stays the only test surface.

### 2. `runKonvaLoop` export (`src/createKonvaAdapter.ts`)

```ts
export type RunKonvaLoopOpts = Readonly<{ signal?: AbortSignal }>;

export async function runKonvaLoop(
    handle: KonvaAdapterHandle,
    opts: RunKonvaLoopOpts = {},
): Promise<void> {
    // throw the documented sentinel on a foreign handle (mirror
    // feedCandleEvent / canvas2d runRendererLoop)
    // resolve interval via handleInterval(handle)
    // abort-guard before start and after each await
    // for await (const event of handle.candles({ interval })) {
    //     feedCandleEvent(handle, event);   // applyCandleEvent + repaint both layers
    //     await handle.host.push(event);
    //     await new Promise<void>((r) => setTimeout(r, 0)); // worker-host yield
    //     handle.onEmissions(await handle.host.drain());
    // }
}
```

- Mirror canvas2d's `runRendererLoop` contract exactly: return
  immediately when `signal` is already aborted; stop pumping when it
  aborts mid-stream; keep the `setTimeout(0)` yield after every
  `host.push` (the canvas2d CLAUDE.md notes removing it breaks the
  worker integration test).
- Reuse the exported `feedCandleEvent` for the per-event candle repaint
  rather than duplicating `applyCandleEvent` + `rebuild*Layer` — it
  already does exactly that.
- JSDoc on the new export + type: `@since` (the next package version
  after `feedCandleEvent`'s `@since 1.4`, i.e. `@since 1.5`), `@stable`,
  and a runnable `@example`, to satisfy `pnpm docs:check`.

### 3. Barrel + CLAUDE.md (`src/index.ts`, `examples/konva-adapter/CLAUDE.md`)

- Export `runKonvaLoop` and `RunKonvaLoopOpts` from `src/index.ts`
  alongside `createKonvaAdapter` / `feedCandleEvent` / `handleInterval`.
- Update `examples/konva-adapter/CLAUDE.md`: the integration-test
  invariant currently states **"Konva has no `runRendererLoop`"** — that
  is no longer true. Reword to: konva now ships `runKonvaLoop` (the
  uniform live drive loop); the integration test MAY drive via it, and
  the `container` option is the DOM-mount seam (parallel to canvas2d's
  `opts.ctx` seam). This update is required by the repo-root rule
  ("a behaviour change that invalidates a documented invariant must
  update the `CLAUDE.md` in the same PR").

### 4. Tests (coverage gate is ON — `vitest run --coverage`)

- Add/extend the konva unit suite to cover **both new branches**:
  - `createKonvaAdapter` **with** a `container` (assert the `Stage`
    config carries it — via `MockKonva`'s recorded config) and
    **without** (existing path unchanged).
  - `runKonvaLoop`: drive a `mockCandleSource` through a mock/in-process
    host and assert `feedCandleEvent`'s repaint + `host.push`/`drain` +
    `onEmissions` ran per event, that an already-aborted signal returns
    without pumping, and that a mid-stream abort stops it. Mirror the
    shape of canvas2d's `runRendererLoop` test.
- The `DEFAULT_ADAPTER` (headless conformance export) and the pinned
  `integration.test.ts` `PINNED_HASH` must be **unchanged** — these
  changes are additive and the EMA-cross bundle emits no new geometry.
  If you refactor the integration test to call `runKonvaLoop`, the hash
  must still match (re-pin only on a deliberate visual change).
- Keep coverage at 100% for the package.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/konva-adapter/src/createKonvaAdapter.ts` | Modify | `container?` opt + conditional `Stage`; `runKonvaLoop` + `RunKonvaLoopOpts` |
| `examples/konva-adapter/src/types.ts` | Modify | `container?: HTMLElement` on the `KonvaNamespace` Stage-config seam |
| `examples/konva-adapter/src/index.ts` | Modify | Export `runKonvaLoop`, `RunKonvaLoopOpts` |
| `examples/konva-adapter/src/createKonvaAdapter.test.ts` | Modify | Cover `container` branch + `runKonvaLoop` (abort, mid-stream stop, per-event drive) |
| `examples/konva-adapter/CLAUDE.md` | Modify | Reword the "no `runRendererLoop`" invariant; document the `container` mount seam |

(Adjust the test file name/path to the package's existing convention if
it differs from `createKonvaAdapter.test.ts`.)

## Gates

- `pnpm --filter chartlang-example-konva-adapter test` (unit +
  integration + conformance, **100% coverage**)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm docs:check` (JSDoc completeness — the new export needs
  `@since` + stability + `@example`)

## Changeset

**None.** `examples/konva-adapter` is `"private": true` and not
published to npm (see `examples/CLAUDE.md`); the changeset gate is
package-scoped and ignores private packages — the other four example
adapters landed without changesets (`.changeset/` has none for them).

## Acceptance Criteria

- `createKonvaAdapter` accepts an optional `container`; with it, the
  `Stage` attaches to the DOM; without it the existing behaviour and all
  existing tests are unchanged.
- `runKonvaLoop(handle, { signal })` is exported and drives the handle
  over its `candleSource` with abort-guarding + the worker-host yield,
  mirroring canvas2d's `runRendererLoop` plus `feedCandleEvent`.
- `src/index.ts` exports `runKonvaLoop` + `RunKonvaLoopOpts`;
  `examples/konva-adapter/CLAUDE.md` no longer claims konva has no run
  loop and documents the `container` seam.
- `MockKonva` accepts a `container` config without throwing; the konva
  package's coverage stays 100% and the integration `PINNED_HASH` is
  unchanged.
- `pnpm --filter chartlang-example-konva-adapter test`, `pnpm typecheck`,
  `pnpm lint`, and `pnpm docs:check` are green.
