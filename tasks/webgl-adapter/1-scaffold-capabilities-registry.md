# Scaffold the webgl adapter package + capabilities + registry wiring

> **Status: TODO**

## Goal

Stand up `examples/webgl-adapter` (`chartlang-example-webgl-adapter`) as
a valid §22.4 package with a capabilities-only adapter, register it in
the adapter SSOT, regenerate the CLI bundles, and add a conformance test
— so the new adapter is discoverable, generated, and passes the
emission-contract conformance suite **before any GL code exists**.

## Prerequisites

None.

## Current Behavior

Five adapters exist. `scripts/adapters/registry.ts` `ADAPTERS` has 5
entries; `pnpm adapters:generate` bakes them into
`packages/cli/src/generated/adapters/*`; `scripts/run-conformance.ts`
derives `CONFORMANCE_ADAPTERS` from the registry.

## Desired Behavior

A sixth adapter `webgl` exists as a private example package with a valid
`WEBGL_CAPABILITIES` bag and a capabilities-only default export, is in
the registry + generated CLI bundle, and passes `pnpm conformance`.

## Requirements

1. **Scaffold (do NOT hand-write the six template files).** Append
   `"examples/webgl-adapter"` to `PACKAGE_DIRS` in `scripts/scaffold.ts`
   and run `pnpm scaffold`. Then adjust the generated `package.json` to
   match the other example adapters: unscoped `"name":
   "chartlang-example-webgl-adapter"`, `"private": true`, no
   `publishConfig`, deps `@invinite-org/chartlang-adapter-kit`
   `workspace:^` + `@invinite-org/chartlang-host-worker` `workspace:^`;
   devDeps `@invinite-org/chartlang-{compiler,core,runtime}` +
   `@types/node`. **No npm chart-lib dependency** (raw WebGL2).

2. **`src/capabilities.ts`** — export `WEBGL_CAPABILITIES: Capabilities`
   copied from `examples/canvas2d-adapter/src/capabilities.ts` (full
   plot-kind / drawing-kind / alert / subpane / lookback surface).
   Target full parity, so claim the same surface canvas2d does. Add
   `@since`/`@example`/stability JSDoc.

3. **`src/index.ts`** — export, with JSDoc on each:
   - `type CreateWebglAdapterOpts` — mirror `CreateCanvas2dAdapterOpts`:
     `canvas` (HTMLCanvasElement | {width,height}), optional `gl` test
     seam (a `WebGL2RenderingContext` injected for browser tests),
     `candleSource`, `capabilities?`, `interval?`, `onAlert?`,
     `initialVisibleBars?: number`, `host?`, `workerLike?`,
     `devicePixelRatio?`.
   - `type WebglAdapterHandle = Adapter & { readonly host: ScriptHost }`.
   - `createWebglAdapter(opts): WebglAdapterHandle` — for THIS task a
     minimal factory: build the host (`createWorkerHost` or the provided
     `host`), capabilities, a no-op `onEmissions`/`dispose`, and
     `candles()`. No GL rendering yet (Tasks 2–8 fill it in behind the
     same surface). Must be constructible from `{ width, height }` alone
     (headless) — do NOT call `canvas.getContext("webgl2")` unless a real
     canvas/`gl` seam is supplied.
   - `runWebglLoop(handle, opts?)` — the shared loop shape (iterate
     `candles({interval})` → `host.push` → yield → `host.drain` →
     `onEmissions`; respect `opts.signal`).
   - `WEBGL_CAPABILITIES` re-export; `default` export = a capabilities-only
     object `{ id:"webgl", name, capabilities: WEBGL_CAPABILITIES, ... }`
     (the conformance test surface, exactly like canvas2d's default).

4. **Registry entry** — add to `scripts/adapters/registry.ts` `ADAPTERS`:
   ```ts
   { id: "webgl", exampleDir: "examples/webgl-adapter", displayName: "WebGL",
     library: "", libraryRange: "", license: "MIT",
     renderTech: "WebGL2 (raw, GPU-instanced)", strategy: "gl",
     fullSurface: true, approxBundleKb: 45,
     bestFor: "GPU-accelerated, TradingView-grade rendering at scale" }
   ```
   If `strategy`/other fields are a closed union, extend the type to
   admit `"gl"`. Keep `approxBundleKb` deterministic (refine after Task 5).

5. **Generate + conformance** — run `pnpm adapters:generate` (bakes
   `packages/cli/src/generated/adapters/webgl.ts` + updates `index.ts` /
   `registry.ts`). Add `src/conformance.test.ts` mirroring
   `examples/echarts-adapter/src/conformance.test.ts`:
   `runConformanceSuite(defaultAdapter)`, assert `failed === 0`,
   `passed > 0`, 300 000 ms timeout.

6. **`src/index.test.ts`** — unit-test the factory: constructs from
   `{width,height}` headlessly, exposes `host` + `capabilities`,
   `dispose()` is idempotent, `runWebglLoop` drains a `mockCandleSource`.

7. **README.md** (≤100 lines, §17.1) + **CLAUDE.md** (new, scaffolded
   stub describing the adapter is WebGL2/zero-dep, capabilities-only
   default, GL filled in by later tasks).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | Append `examples/webgl-adapter` to `PACKAGE_DIRS` |
| `examples/webgl-adapter/{package.json,tsconfig.json,vitest.config.ts,README.md}` | Create (scaffold) | §22.4 surface |
| `examples/webgl-adapter/src/capabilities.ts` | Create | `WEBGL_CAPABILITIES` |
| `examples/webgl-adapter/src/index.ts` | Create | Factory + loop + default export |
| `examples/webgl-adapter/src/index.test.ts` | Create | Factory unit tests |
| `examples/webgl-adapter/src/conformance.test.ts` | Create | Shared suite |
| `examples/webgl-adapter/CLAUDE.md` | Create | Adapter invariants stub |
| `scripts/adapters/registry.ts` | Modify | Add `webgl` entry |
| `packages/cli/src/generated/adapters/*` | Regenerate | `pnpm adapters:generate` |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check`
- `pnpm test` (webgl adapter tests pass; **not** in the 100% coverage
  gate — `coverage-merge` walks `packages/*` + `examples/canvas2d-adapter`
  only, so confirm webgl is excluded and unit tests still pass)
- `pnpm adapters:gate` (committed bundle matches generated)
- `pnpm conformance` (webgl: all scenarios pass)
- `pnpm readme:check`

## Changeset

None — `examples/*` is private/unpublished; the §22 changeset gate is
package-scoped to `@invinite-org/chartlang-*`. (Confirm the CLI bundle
change to `packages/cli/src/generated/` does not itself require one — it
is generated, not hand-authored.)

## Acceptance Criteria

- `examples/webgl-adapter` scaffolded with the unscoped private name and
  no chart-lib dependency.
- `WEBGL_CAPABILITIES` matches the canvas2d surface; default export is
  capabilities-only and headless-constructible.
- Registry entry present; `pnpm adapters:generate` + `pnpm adapters:gate`
  green; CLI bundle includes `webgl`.
- `pnpm conformance` passes for `webgl`; `index.test.ts` green.
- JSDoc + README + CLAUDE.md present; typecheck/lint/format green.
