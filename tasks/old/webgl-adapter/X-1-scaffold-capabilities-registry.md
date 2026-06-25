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
     `canvas` (HTMLCanvasElement | OffscreenCanvas | {width,height} —
     include `OffscreenCanvas`, which WebGL2 supports and canvas2d's opts
     already accept), optional `gl` test seam (a `WebGL2RenderingContext`
     injected for browser tests), `candleSource`, `capabilities?`,
     `interval?`, `onAlert?`, `alertBadgeFilter?` (filters which alerts
     populate the on-canvas badge buffer — canvas2d exposes it and Task 12
     references it as "the Task 1 opt"; omit it here and Task 12 has
     nothing to read), `initialVisibleBars?: number`, `host?`,
     `workerLike?`, `devicePixelRatio?`. (A `palette?: Palette` opt is
     optional; if omitted, the bull/bear/series palette comes from the
     default in the ported `colors.ts` — Task 4.)
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
     object `{ id:"webgl-reference-default", name, capabilities:
     WEBGL_CAPABILITIES, ... }` (the conformance test surface, exactly like
     canvas2d's `DEFAULT_ADAPTER`, whose `Adapter.id` is
     `"canvas2d-reference-default"` — distinct from the registry id
     `"webgl"`). `Adapter.symInfo` / `resolveInputs` are optional on the
     contract, so the capabilities-only triple is sufficient; mirror
     canvas2d's `defaultAdapter.ts` no-op `candles`/`onEmissions`/`dispose`.

4. **Registry entry** — append to `scripts/adapters/registry.ts` `ADAPTERS`
   **last** (canvas2d must stay `ADAPTERS[0]`, the conformance reference
   `run-conformance.ts` pins; webgl is also last alphabetically):
   ```ts
   { id: "webgl", exampleDir: "examples/webgl-adapter", displayName: "WebGL",
     library: "(none)", libraryRange: "(built-in)", license: "MIT",
     renderTech: "WebGL2 (raw, GPU-instanced)", strategy: "gl",
     fullSurface: true, approxBundleKb: 45,
     bestFor: "GPU-accelerated, TradingView-grade rendering at scale" }
   ```
   Use the `"(none)"` / `"(built-in)"` sentinels (NOT empty strings, like
   canvas2d) — `gen-adapters.ts` special-cases `entry.library === "(none)"`
   to render "none (zero external dependencies)"; an empty string falls
   through and renders an empty `` `` `` cell. `strategy` is a CLOSED union
   (`AdapterStrategy = "ctx" | "nodes" | "graphic" | "native-ctx"`), so you
   MUST also:
   - add `| "gl"` to the `AdapterStrategy` union + a `` - `gl` — `` bullet
     to its doc-comment in `scripts/adapters/registry.ts`, and
   - add a `gl:` entry to the **exhaustive** `STRATEGY_BLURB`
     `Record<AdapterStrategy, string>` in `scripts/gen-adapters.ts`
     (e.g. `gl: "uploads the decomposed geometry to GPU programs and paints
     text through a 2D-canvas overlay"`). Without it, `gen-adapters.ts`
     fails `pnpm typecheck` and the gallery card renders `undefined`.

   Keep `approxBundleKb` deterministic (refine after Task 5).

5. **Generate + conformance** — run `pnpm adapters:generate` (bakes
   `packages/cli/src/generated/adapters/webgl.ts` + updates the generated
   `index.ts` / `registry.ts`, AND regenerates `docs/adapters/gallery.md`,
   whose committed copy `gen-adapters.test.ts` re-derives from `ADAPTERS`).
   Add `src/conformance.test.ts` mirroring
   `examples/echarts-adapter/src/conformance.test.ts`:
   `runConformanceSuite(defaultAdapter)`, assert `failed === 0`,
   `passed > 0`, 300 000 ms timeout.

6. **Update the registry test + generator count prose (else `pnpm test`
   fails / docs go stale).**
   - `scripts/adapters/registry.test.ts` hard-asserts the EXACT 5-id list
     (`["canvas2d","echarts","konva","lightweight-charts","uplot"]`) and
     is titled "declares the five full-surface example adapters". It runs
     under the root `pnpm test` (root vitest collects
     `scripts/**/*.test.ts`) **and** `pnpm test:scripts`, so it will FAIL
     once `webgl` is appended. Add `"webgl"` (last) to the expected list
     and change "five" → "six" in the title.
   - `scripts/gen-adapters.ts` carries **hard-coded** adapter-count prose
     it emits into `docs/adapters/gallery.md` — `adapters:gate` will NOT
     catch a stale count because the generated and committed copies match.
     Update: "All five share one renderer-agnostic geometry layer" → "All
     six …"; "the other four are run pass/fail" → "the other five …"
     (and the matching `(none)` doc-comment that says "the other four").
     Re-run `pnpm adapters:generate` afterward so `gallery.md` reflects it.

7. **`src/index.test.ts`** — unit-test the factory: constructs from
   `{width,height}` headlessly, exposes `host` + `capabilities`,
   `dispose()` is idempotent, `runWebglLoop` drains a `mockCandleSource`.

8. **README.md** (≤100 lines, §17.1) + **CLAUDE.md** (new, scaffolded
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
| `scripts/adapters/registry.ts` | Modify | Add `webgl` entry + extend `AdapterStrategy` union/doc with `"gl"` |
| `scripts/gen-adapters.ts` | Modify | Add `gl` `STRATEGY_BLURB` entry; bump hard-coded "five"/"other four" count prose |
| `scripts/adapters/registry.test.ts` | Modify | Add `"webgl"` to the expected id list; "five" → "six" |
| `packages/cli/src/generated/adapters/*` | Regenerate | `pnpm adapters:generate` |
| `docs/adapters/gallery.md` | Regenerate | `pnpm adapters:generate` (gallery includes webgl) |

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
- Registry entry present (appended last; canvas2d stays `ADAPTERS[0]`);
  `AdapterStrategy` union + `STRATEGY_BLURB` extended with `"gl"`;
  `library`/`libraryRange` use the `(none)`/`(built-in)` sentinels.
- `pnpm adapters:generate` + `pnpm adapters:gate` green; CLI bundle +
  regenerated `docs/adapters/gallery.md` include `webgl` (gallery shows
  "Library: none").
- `scripts/adapters/registry.test.ts` updated (lists six ids) and green
  under `pnpm test`; `gen-adapters.ts` count prose bumped to six/five.
- `pnpm conformance` passes for `webgl`; `index.test.ts` green.
- JSDoc + README + CLAUDE.md present; typecheck/lint/format green.
