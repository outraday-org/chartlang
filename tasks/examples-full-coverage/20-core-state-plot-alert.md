# Core — State, Plot, Hline & Alert

> **Status: TODO**

## Goal

One runnable example per `state.*` slot (incl. `state.tick.*`), plus
`plot`, `hline`, and `alert`, categories `state-plot-alert`; shrink the
allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per the base rules in [Task 3](./3-ta-moving-averages.md). The `state.*`
examples must demonstrate **persistence across bars** (Pine `var`
semantics): initialize once, mutate per bar, and `plot`/`alert` the
accumulated value so persistence is observable. The `state.tick.*`
variants demonstrate intrabar (per-tick) persistence — note in the
comment that the demo feeds confirmed bars, so the tick semantics are
documented even if visually identical on bar-close data (must still
compile + run clean). `plot`/`hline`/`alert` examples are minimal,
focused demonstrations of each call's option surface.

## Primitives

| Primitive id | Example concept |
|--------------|-----------------|
| `state.int` | Persistent bar counter plotted as a step series. |
| `state.float` | Running max-close held in a `state.float` slot. |
| `state.bool` | Latch flag set on first cross, held thereafter. |
| `state.string` | Last-signal label held in a `state.string` slot. |
| `state.tick.int` | Intrabar tick counter (documented tick persistence). |
| `state.tick.float` | Intrabar running sum. |
| `state.tick.bool` | Intrabar latch. |
| `state.tick.string` | Intrabar last-event label. |
| `state.series` | covered (`up-streak`, migrated default — Task 1 §6b) — skip if absent from the allowlist. |
| `state.array` | covered (`rolling-window-mean`, migrated default — Task 1 §6b) — skip if absent. |
| `state.map` | covered (`volume-by-level`, migrated default — Task 1 §6b) — **only** once `tasks/state-map` lands `state/map.md`; until then it stays allowlisted (see Task 1 §6b †). |
| `plot` | Multi-option `plot` (color, lineWidth, lineStyle, title). |
| `hline` | Two `hline` guides (overbought/oversold) on an oscillator. |
| `alert` | `alert(...)` with `severity` on a cross condition. |

> `plot`/`hline`/`alert` may already be partly covered by migrated
> examples; ship a **dedicated focused** example for each id still in
> the allowlist (a primitive can appear in multiple examples — the gate
> only needs ≥1, but these dedicated demos are the canonical reference
> examples for those pages). **In particular `alert` is credited to the
> migrated `session-high-alert` composite (Task 1 §6)**, so it is absent
> from the allowlist — skip it unless you choose to add a second focused
> demo. Likewise `state.float`/`state.int` are used by migrated
> composites but are credited headline-only there, so they **remain** in
> the allowlist and still need their dedicated example here.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (≈8–11) | Create | One per uncovered id. |
| `examples/catalogue/core-state-plot-alert.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-core-state-plot-alert.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id; `state.*`
  examples demonstrate cross-bar persistence; catalogue + allowlist
  updated; generators re-run; gates green.
