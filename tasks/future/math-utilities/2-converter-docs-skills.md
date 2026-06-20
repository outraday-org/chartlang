# Task 2 — Pine `math.*` converter mapping + docs/skills/example

> **Status: TODO**

## Goal

Map the supported Pine `math.*` / `na` / `nz` calls onto the chartlang `math`
namespace in the converter, and publish the docs reference page, author-skill
reference entry, and one runnable example.

## Prerequisites

- Task 1 (core `math` namespace + ambient shim) complete.

## Current Behavior

- The Pine converter (`packages/pine-converter/src/transform/`) may already map
  some `math.*` calls onto bare `Math.*` (verify — `grep -rn "math" packages/pine-converter/src/transform`).
  This task adds the chart-aware subset that now has a `math.*` target.
- No author-facing docs/skill entry for `math.*`.

## Desired Behavior

| Pine | chartlang |
|------|-----------|
| `math.round_to_mintick(x)` | `math.roundToMintick(x, syminfo.mintick)` — converter injects `syminfo.mintick` as the explicit step |
| `na(x)` | `math.na(x)` |
| `nz(x)` / `nz(x, r)` | `math.nz(x)` / `math.nz(x, r)` — **scalar** form; if the Pine `x` is a Series the converter must instead route to `ta.nz` (see routing note) |
| `math.avg(a, b, …)` | `math.avg(a, b, …)` |
| `math.sum(series, len)` | **NOT** `math.sum` — Pine `math.sum` is a rolling window → route to the existing `ta`-family rolling-sum target, not the scalar `math.sum`. Emit a diagnostic if no rolling target exists. |
| `math.sign(x)` | `math.sign(x)` |
| `math.abs/pow/sqrt/floor/ceil/round/min/max/log/exp(...)` | bare `Math.*` (unchanged — these stay on `Math`, per the namespace's no-rewrap decision) |

### Routing notes

- **`nz` scalar vs series:** Pine `nz` is overloaded. If the converter's type
  inference (or the AST shape) indicates a Series argument, emit `ta.nz(...)`;
  for a scalar, emit `math.nz(...)`. If ambiguous, prefer `math.nz` and emit an
  advisory diagnostic. Document the rule in the transform.
- **`math.sum`/`math.avg` arity:** Pine `math.sum(source, length)` is a
  2-arg rolling window — distinct from chartlang's variadic scalar
  `math.sum(...)`. The converter must **not** map the rolling form to the
  scalar one. Route rolling `math.sum`/`math.avg(source, length)` to the
  appropriate `ta` rolling target (or diagnostic + `// TODO`).

## Requirements

### 1. Pine converter (`packages/pine-converter/src/transform/`)

- Extend the `math`/global-call transform with the mappings above.
- For `math.round_to_mintick(x)`: emit `math.roundToMintick(x, syminfo.mintick)`
  (inject the `syminfo.mintick` member access — confirm `syminfo` is in scope
  in the emitted `compute`).
- Implement the `nz` scalar/series routing + the `math.sum`/`avg` arity guard
  with diagnostics from the existing code registry
  (`packages/pine-converter/src/diagnostics/codes.ts`).
- Bare-`Math` mappings stay as-is — only confirm they are not accidentally
  rerouted to `math.*`.
- Co-locate converter unit tests: each mapped name, `round_to_mintick` step
  injection, `nz` scalar vs series routing, and the rolling-`math.sum` guard.

### 2. Docs (`docs/`)

- Add a `math` reference page (mirror `color`): one row per member, signature,
  semantics. **Prominently state** that bare `Math.*` is available and that
  `math.*` only adds the chart-aware extras (avoids author confusion about
  where `abs`/`sqrt` live). Cross-link `ta.nz` (series) vs `math.nz` (scalar).
  Update nav.

### 3. Author skill (`skills/chartlang-coding/`)

- Add a `math.*` section to `references/translating-from-pine.md` (table
  above + the "bare Math is fine" note + the `nz` scalar/series distinction).
- If `SKILL.md` enumerates namespaces or notes that `Math.*` is allowed, add
  the `math` namespace + the `math.nz`/`ta.nz` distinction.

### 4. Example + live-demo wiring (`examples/scripts/` + `apps/site`)

Follow the example pipeline (`examples/CLAUDE.md`, `apps/CLAUDE.md`,
`tasks/examples-full-coverage/`):

1. **Source** — `examples/scripts/tick-snapped-levels.chart.ts`: compute
   support/resistance levels and `math.roundToMintick(level, syminfo.mintick)`
   them before drawing `draw.horizontalLine`s — the namespace's headline
   feature. (Note: `examples/scripts/mintick-snapped-entry.chart.ts` already
   exists — make the new example clearly distinct or extend the existing one
   rather than duplicating it.)
2. **e2e compile** — append to `EXAMPLE_SCRIPTS` in
   `packages/cli/src/e2e.test.ts:13`.
3. **Live demo + docs Examples** — add a `DEMO_SCRIPTS` entry in
   `apps/site/src/components/demo/scripts.ts` (`source` inlined as a string);
   language/utilities category if the categorized dialog has landed.
4. **Generate + gate** — `pnpm examples:generate`; keep `pnpm examples:gate`
   green.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/<math/global family>.ts` | Modify | Map the `math.*` subset + `na`/`nz` routing. |
| `packages/pine-converter/src/transform/<…>.test.ts` | Modify/Create | Converter unit tests. |
| `docs/language/math.md` | Create | Reference page. |
| `docs/.vitepress/config.*` | Modify | Nav entry. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Mapping table + notes. |
| `examples/scripts/tick-snapped-levels.chart.ts` | Create | Example. |
| `packages/cli/src/e2e.test.ts` | Modify | Add example to `EXAMPLE_SCRIPTS`. |
| `apps/site/src/components/demo/scripts.ts` | Modify | `DEMO_SCRIPTS` entry (live demo + docs Examples). |
| `.changeset/math-converter.md` | Create | patch (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm examples:gate` (after `pnpm examples:generate`)
- `pnpm skills:gate`

## Changeset

`.changeset/math-converter.md` — **patch** (pine-converter).

## Acceptance Criteria

- `math.round_to_mintick` converts with injected `syminfo.mintick`; `na`/`nz`
  route scalar→`math`, series→`ta`; rolling `math.sum`/`avg` is not collapsed
  to the scalar form; bare `Math.*` untouched.
- Docs page clearly states bare `Math` is available; skill mapping updated.
- Example compiles in e2e (`EXAMPLE_SCRIPTS`) and appears in the live demo
  (`DEMO_SCRIPTS`); `examples:gate` green.
- Coverage + docs + readme + skills gates green; changeset committed.
