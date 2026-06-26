# Core — Inputs

> **Status: TODO**

## Goal

One runnable example per `input.*` builder, category `inputs`; shrink
the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per the base rules in [Task 3](./3-ta-moving-averages.md). **Edge case —
no input UI:** the demo has no input-override panel, so every example
resolves its input to the **default value** (per README §4). Author each
example so it renders meaningfully at the default: declare the input at
the top of `compute` (or per the documented input-declaration site —
check `docs/primitives/input/<name>.md`), then **use** the resolved
value to drive a `plot`/`ta` call so its effect is observable. Each
example focuses on one builder but may declare a second trivial input
for context. `overlay` per what is plotted.

## Primitives

| Primitive id | Example concept |
|--------------|-----------------|
| `input.int` | `length = input.int(20)` driving `ta.sma`. |
| `input.float` | `mult = input.float(2.0)` driving a band width. |
| `input.bool` | `showMa = input.bool(true)` gating a `plot`. |
| `input.string` | `label = input.string("EMA")` used as a plot title. |
| `input.enum` | `mode = input.enum([...], "ema")` selecting MA type. |
| `input.color` | `col = input.color("#26a69a")` as a plot color. |
| `input.source` | `src = input.source("close")` feeding an MA. |
| `input.int` (length variant) | covered by the first row — keep one example. |
| `input.interval` | `tf = input.interval("1D")` feeding `request.security`. |
| `input.price` | `level = input.price(...)` as an `hline`/level. |
| `input.time` | `anchor = input.time(...)` as a draw anchor base. |
| `input.symbol` | `sym = input.symbol(...)` feeding `request.security`. |
| `input.externalSeries` | `ext = input.externalSeries(...)` plotted as an overlay. |
| `input.session` | covered (`weekday-close-filter`, migrated default — Task 1 §6b) — skip if absent from the allowlist. |

> Build exactly one example per **distinct** `input.*` id present under
> `docs/primitives/input/` (now **13** builders: bool, color, enum,
> externalSeries, float, int, interval, price, **session**, source,
> string, symbol, time — `session` was added since this plan was
> written and is already covered by the migrated `weekday-close-filter`
> default). The duplicated `input.int` row above is illustrative — ship
> one `input.int` example.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×12) | Create | One per builder. |
| `examples/catalogue/core-inputs.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove `input.*` ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×12) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-core-inputs.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per `input.*` builder, each
  rendering meaningfully at the input default; catalogue + allowlist
  updated; generators re-run; gates green.
