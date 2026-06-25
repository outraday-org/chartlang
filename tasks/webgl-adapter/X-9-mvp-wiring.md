# MVP wiring: react-starter seam + demo + installer + matrix + CLAUDE.md

> **Status: TODO**

## Goal

Make the MVP webgl renderer **selectable and clonable** end-to-end: add
the react-starter seam variant (+ byte-identical create-chartlang
installer template), the apps/site demo driver + registry entry, and
update every CLAUDE.md that documents the adapter count. After this task
a user can pick "WebGL" in the demo and `add-adapter webgl` in a clone.

## Prerequisites

Tasks 5–8 (a working MVP renderer: factory + run loop + candles + lines +
axes + interaction).

## Current Behavior

`webgl` is in the registry/CLI bundle/conformance (Task 1) but NOT in the
react-starter `SEAM_VARIANTS`, the create-chartlang `seamTemplates`, or
the apps/site `DEMO_ADAPTERS` — so it cannot be selected or cloned.

## Desired Behavior

`SEAM_VARIANTS` has 6 entries (incl. `webgl`); the create-chartlang
template matches byte-for-byte; the demo lists "WebGL" and renders it;
the react-starter `adapter-matrix.spec.ts` builds the webgl seam.

## Requirements

1. **react-starter seam** — add a `WEBGL_SEAM` const + `SEAM_VARIANTS`
   entry to `apps/react-starter/src/lib/chart/seamVariants.ts`. Like
   canvas2d (raw, no chart lib): `createActiveAdapter` creates a `<canvas>`
   in the container, backs it at `cssWidth*dpr` (HiDPI), and calls
   `createWebglAdapter({ canvas, candleSource, devicePixelRatio: dpr,
   initialVisibleBars: 120, ...interval, ...onAlert })`; `runActiveLoop`
   → `runWebglLoop`. `mount: "canvas"`, `lib: ""`, `pkg:
   "chartlang-example-webgl-adapter"`. (The committed `activeAdapter.ts`
   stays the canvas2d variant — byte-identity unchanged.)

2. **create-chartlang template** — mirror the SAME `WEBGL_SEAM` body into
   `packages/create-chartlang/src/seamTemplates.ts` (add to `SEAM_IDS` +
   the `seamTemplateFor` switch), byte-identical after the
   example-adapter-name substitution. `seamTemplates.test.ts` (imports the
   real `SEAM_VARIANTS`) must pass.

3. **demo driver** — create `apps/site/src/components/demo/adapters/webgl.ts`
   (a `DemoAdapterFactory` that dynamic-imports the adapter, builds a
   `<canvas>`, passes `initialVisibleBars` via the conditional spread,
   returns `{host, run: runWebglLoop, dispose}`), and add a `DEMO_ADAPTERS`
   entry `{ id:"webgl", label:"WebGL", load: () => import("./webgl")... }`
   in `registry.ts`. The id mirrors `scripts/adapters/registry.ts`. Keep
   the lazy dynamic-import rule (no static heavy import in the SSR graph).

4. **CLAUDE.md updates** — bump the documented adapter/seam count to six
   in: `apps/CLAUDE.md` (DEMO_ADAPTERS list), `apps/react-starter/CLAUDE.md`
   (seam SSOT), `packages/create-chartlang/CLAUDE.md` (SEAM_IDS),
   `scripts/CLAUDE.md` (ADAPTERS), `examples/CLAUDE.md` (layout). Flesh out
   `examples/webgl-adapter/CLAUDE.md` (GL pipeline, overlay-text split,
   pure-packers-tested / browser-only-gl, reuse of ViewController/
   decomposeDrawing, provenance).

5. **Verify** — `pnpm adapters:gate`, `seamTemplates` parity test,
   `apps/site` build (bundles webgl), and the react-starter
   `adapter-matrix` Playwright spec (builds the webgl seam variant).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/lib/chart/seamVariants.ts` | Modify | Add `WEBGL_SEAM` + entry |
| `packages/create-chartlang/src/seamTemplates.ts` | Modify | Byte-identical template + SEAM_IDS |
| `apps/site/src/components/demo/adapters/webgl.ts` | Create | Demo driver |
| `apps/site/src/components/demo/adapters/registry.ts` | Modify | `DEMO_ADAPTERS` entry |
| `apps/CLAUDE.md`, `apps/react-starter/CLAUDE.md`, `packages/create-chartlang/CLAUDE.md`, `scripts/CLAUDE.md`, `examples/CLAUDE.md`, `examples/webgl-adapter/CLAUDE.md` | Modify | Doc the sixth adapter |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- create-chartlang `seamTemplates.test.ts` (byte parity)
- `pnpm build` (apps/site bundles webgl; react-starter builds)
- react-starter `adapter-matrix` (webgl seam builds) — run via Playwright
  if the env allows; else rely on `apps/site` build + byte parity
- `pnpm adapters:gate` · `pnpm conformance`

## Changeset

None for the example adapter. If touching published `create-chartlang`
behavior counts under the changeset gate, add a `patch` changeset for
`@invinite-org/create-chartlang` (new selectable adapter template).

## Acceptance Criteria

- `SEAM_VARIANTS` (6) + create-chartlang template are byte-identical
  (parity test green).
- Demo lists + renders "WebGL"; ids mirror the registry.
- All five CLAUDE.md count references updated; webgl CLAUDE.md fleshed
  out.
- Build + adapter-matrix + conformance + parity gates green. **MVP is
  shippable and clonable.**
