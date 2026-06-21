# Task 4 — Adapter switcher UI + URL param + e2e

> **Status: TODO**

## Goal

Add the user-facing adapter switcher: a `Select` right-aligned in the
chart toolbar (next to Play), backed by an `adapterId` state in
`DemoBody` that defaults to `canvas2d` and preselects from
`?adapter=<id>` — mirroring the existing `?script=` pattern. Cover the
new surface with a Playwright e2e spec that switches across all five
adapters and asserts each renders.

## Prerequisites

Task 3 (ChartPane consumes `adapterId`).

## Current Behavior

`DemoBody.tsx` owns `scriptId` (init from `?script=` via the local
`initialScriptId()` function) and renders a single script `Select` in a
top toolbar row. `ChartPane` is rendered with no adapter control; its
toolbar shows only Play + a mode span.

## Desired Behavior

`DemoBody` additionally owns `adapterId` (init from `?adapter=`,
default `canvas2d`), passes `adapterId` + `onAdapterChange` to
`ChartPane`, and keeps `?adapter=` in the URL in sync. `ChartPane`
renders an adapter `Select` right-aligned in its `.chart-toolbar`. A
Playwright spec proves every adapter renders the compiled script.

## Requirements

### 1. `DemoBody.tsx` — state + URL param

- Add `resolveInitialAdapterId()` mirroring the existing
  `initialScriptId()` (the actual function name in `DemoBody.tsx`): read
  `?adapter=<id>` from `window.location.search` (guard
  `typeof window === "undefined"` for SSR, like `initialScriptId`),
  return it when `isDemoAdapterId(id)` (from `adapters/registry.ts`),
  else `DEFAULT_ADAPTER_ID`.
- `const [adapterId, setAdapterId] = useState(resolveInitialAdapterId)`
  (pass the function as the lazy initialiser, exactly like
  `useState(initialScriptId)`).
- `?script=` is **read-only on load** in `DemoBody` today — there is no
  back-sync to the URL. So writing `?adapter=` is a new behaviour: on
  change, update it with `history.replaceState` (no navigation — the demo
  is client-only and must not trigger a router nav), guarding
  `typeof window`. Keep `?script=` untouched in the same write.
- Pass `adapterId={adapterId}` and `onAdapterChange={(id) => {
  setAdapterId(id); /* history.replaceState ?adapter= */ }}` to
  `ChartPane`. Switching the adapter must NOT reset the script, alerts,
  or artifact (unlike the script `Select`, which clears
  `alerts`/`artifact`).
- Pass `adapterId={adapterId}` and `onAdapterChange={(id) => {
  setAdapterId(id); /* sync URL */ }}` to `ChartPane`. Switching the
  adapter must NOT reset the script, alerts, or artifact (unlike the
  script `Select`, which clears `alerts`/`artifact`).

### 2. `ChartPane.tsx` — the control in the toolbar

- Extend `ChartPaneProps` with `onAdapterChange: (id: string) => void`.
- In `.chart-toolbar`, keep Play on the left and add the adapter
  `Select` on the right (e.g. toolbar `justify-between`, or the Select
  wrapped in `ml-auto`). Mirror the **exact** shape of the script
  `Select` in `DemoBody.tsx`: pass an `items` prop —
  `items={DEMO_ADAPTERS.map((a) => ({ label: a.label, value: a.id }))}` —
  with `value={adapterId}` and `onValueChange={(v) => onAdapterChange(v ?? DEFAULT_ADAPTER_ID)}`,
  wrapping `SelectTrigger`/`SelectValue` + `SelectContent` of
  `SelectItem`s inside (the script Select uses the `items` prop AND the
  inner items). `onValueChange` from the Base UI primitive is typed
  `(value: string | null) => void`, so the `v ?? DEFAULT_ADAPTER_ID`
  null-coalesce is required.
- Give the trigger an accessible label (e.g. wrap with a `<label>` /
  `aria-label="Adapter"`) so the e2e spec and screen readers can target
  it. Keep the mode span (`static history` / `loading renderer…` /
  streaming) visible.
- Disable the adapter `Select` while a Play run is streaming
  (`playing`), to avoid a mid-stream re-mount; re-enable on stop.

### 3. e2e — `apps/site/tests/e2e/demo-adapters.spec.ts`

Model it on `landing.spec.ts` (`#demo`, `.cm-content`, Play enables once
the artifact + bars arrive):

- Navigate to the demo (`#demo` on the landing page).
- For each `DEMO_ADAPTERS` id, select it in the adapter `Select`, wait
  for the chart to render, and assert a surface exists inside
  `.chart-surface` (a `<canvas>` for canvas2d/uplot, an `<svg>`/`<canvas>`
  for echarts/lwc/konva — assert `.chart-surface` has at least one
  element child and no error overlay). Assert no `pageerror` /
  `console.error` fired during the switch.
- Assert `?adapter=` round-trips: navigate to `…?adapter=echarts#demo`
  and confirm the echarts surface mounts on load.
- konva is included in the five — it mounts because Task 1 added the
  `container` option + `runKonvaLoop` (Konva renders into a `<canvas>`
  inside its content `<div>`, so the "≥1 element child" assertion holds).
- Keep timeouts generous — the first switch to a heavy lib lazy-loads a
  chunk.
- **`landing.spec.ts` stays green unchanged**: it targets
  `demo.locator("canvas.chart-canvas")`, and the canvas2d driver (Task 2)
  gives its inner canvas that class. Do not edit `landing.spec.ts`; if it
  fails, the canvas2d driver dropped the `chart-canvas` class — fix the
  driver, not the spec.

### 4. Docs / sync gates — confirm none triggered

- This task does **not** touch `DEMO_SCRIPTS`, so `pnpm examples:sync` /
  `pnpm examples:generate` are **not** required (`apps/CLAUDE.md`). Do
  not edit any example script.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/demo/DemoBody.tsx` | Modify | `adapterId` state, `?adapter=` init + sync, pass to ChartPane |
| `apps/site/src/components/demo/ChartPane.tsx` | Modify | adapter `Select` right-aligned in toolbar, `onAdapterChange` prop, disable while playing |
| `apps/site/src/components/demo/demo.css` | Modify | toolbar layout for the right-aligned select (if needed) |
| `apps/site/tests/e2e/demo-adapters.spec.ts` | Create | Playwright: switch all five adapters + `?adapter=` deep-link |

## Gates

- `pnpm --filter chartlang-site typecheck`
- `pnpm --filter chartlang-site build`
- `pnpm --filter chartlang-site e2e` (new spec + existing
  `landing.spec.ts`/`converter.spec.ts` stay green). Requires
  `pnpm --filter chartlang-site e2e:install` for the Chromium binary.

## Changeset

None (`apps/site` private).

## Acceptance Criteria

- The adapter `Select` renders right-aligned in the chart toolbar; the
  five labels match `DEMO_ADAPTERS`.
- Default load is canvas2d; `?adapter=<id>` preselects a valid id and
  falls back to canvas2d for an unknown id; switching syncs `?adapter=`
  without a router navigation and without clearing the script/alerts.
- The new Playwright spec renders all five adapters and verifies the
  deep-link, with no page/console errors during switches.
- `typecheck` + `build` + `e2e` green; no `DEMO_SCRIPTS` / examples gate
  touched.
