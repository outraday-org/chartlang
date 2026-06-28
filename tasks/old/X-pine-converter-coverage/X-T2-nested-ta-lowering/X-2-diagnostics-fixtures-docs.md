# Task 2 — Diagnostics, fixtures, compile round-trip, docs/skills/CLAUDE

> **Status: TODO**

## Goal

Make the Task-1 lowering observable and durable: register its diagnostics,
add fixture triples that round-trip through the compiler, retire the
KNOWN-GAP prose, and update the docs/skills surface. After this task a nested
`ta.*` expression is **never** a silent non-compiling output.

## Prerequisites

- Task 1 (recursive nested `ta.*` → `.current` lowering) complete.

## Current Behavior

- Nested-`ta` arithmetic emits bare-`Series` chartlang with **no** diagnostic
  (silent), and `packages/pine-converter/CLAUDE.md` documents it under
  "KNOWN GAPS".
- Diagnostic codes live in `packages/pine-converter/src/diagnostics/codes.ts`
  (`DIAGNOSTIC_CODE_ENTRIES`, append-only — the public contract). The
  `code-coverage-grep.test.ts` walks every `makeDiagnostic`/`pushCode` literal
  and asserts it is a registered key.
- Fixtures are numbered triples under `packages/pine-converter/fixtures/`
  (`NN.pine` + `NN.expected.chart.ts` + `NN.expected.diagnostics.json`); the
  compile round-trip is `src/tests/fixtures-compile.test.ts` with the
  `KNOWN_NON_COMPILING` skip set. Highest current number is **30**; use the
  next free number (**≥ 31**; confirm against the dir — sibling TX tasks also
  add fixtures).

## Desired Behavior

- An **info** marks each nested lowering; a **warning** fires only if a `ta.*`
  survives un-lowered in a scalar position (the Task-1 safety net).
- A fixture exercising `ta*scalar`, `scalar+ta`, ternary-with-`ta`, and
  `ta`-inside-`ta`-arg converts **and compiles** (out of `KNOWN_NON_COMPILING`).
- The CLAUDE.md "KNOWN GAPS" nested-`ta` sentence is removed.

## Requirements

### 1. Diagnostics (`src/diagnostics/codes.ts`)

APPEND (no reorder, no rename of existing codes):

- **`nested-ta-lowered`** (info) — namespaced
  `pine-converter/transform/nested-ta-lowered`, message ~"Nested `ta.*` call
  projected to its per-bar `.current` scalar." Raise it from the Task-1 rule
  when it wraps a non-top-level `ta.*` (dedupe to one per script if the volume
  is noisy — match the once-per-script `pushCode(...).has(...)` precedent).
- **`nested-ta-not-lowered`** (warning) — the residual-series safety net: a
  `ta.*` reached emission in a scalar value position the rule could not
  classify. Message ~"`ta.*` left as a Series in a scalar position; the
  generated code may not type-check." This replaces today's silent output.

Both keys must be registered so `code-coverage-grep.test.ts` passes.

### 2. Fixture (`packages/pine-converter/fixtures/`)

Add `31-nested-ta-arith.pine` (next free number):

```pine
//@version=6
indicator("Nested ta arithmetic", overlay=false)
scale = input.float(0.1, "Scale", step=0.02)
r = ta.rsi(close, 14) * scale
w = ta.wma((high + low) / 2, 5) * 2 + 1
s = close > open ? ta.ema(close, 8) : ta.sma(close, 8)
y = ta.sma(ta.atr(14), 5)
plot(r)
plot(w)
plot(s)
plot(y)
```

Add `31-nested-ta-arith.expected.chart.ts` (each `ta.*` carries `.current` per
Task 1's rule) and `31-nested-ta-arith.expected.diagnostics.json` (the
`nested-ta-lowered` infos). Keep it **OUT** of `KNOWN_NON_COMPILING` —
it must round-trip and compile through `src/tests/fixtures-compile.test.ts`.

### 3. Retire the KNOWN GAP (`packages/pine-converter/CLAUDE.md`)

- Remove the "KNOWN GAPS" sentence about nested `ta.*` not compiling (per the
  repo rule: a behavior change updates that folder's CLAUDE.md). If any entry
  in `KNOWN_NON_COMPILING` (`src/tests/fixtures-compile.test.ts`) was caused by
  nested-`ta` (audit `14-polyline-rebuild`, `20-real-world-sr`), remove it and
  let it compile; if its non-compile cause is unrelated, leave it and note why.

### 4. Docs + skills

- `docs/converter/supported.md`: add nested-`ta` arithmetic to the supported
  idioms (the `ta.*` row currently implies top-level only).
- `docs/converter/diagnostics.md` is generated — re-run its generator so the
  two new codes get pages; the docs anchor derives from the code slug.
- `skills/chartlang-coding/references/translating-from-pine.md`: note that
  `ta.*` may appear anywhere in an expression (no manual `.current` needed).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `nested-ta-lowered` (info) + `nested-ta-not-lowered` (warning). |
| `packages/pine-converter/fixtures/31-nested-ta-arith.pine` | Create | Fixture source. |
| `packages/pine-converter/fixtures/31-nested-ta-arith.expected.chart.ts` | Create | Expected output. |
| `packages/pine-converter/fixtures/31-nested-ta-arith.expected.diagnostics.json` | Create | Expected diagnostics. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep `31` out of `KNOWN_NON_COMPILING`; prune any nested-`ta`-caused entry. |
| `packages/pine-converter/CLAUDE.md` | Modify | Remove nested-`ta` KNOWN GAP prose. |
| `docs/converter/supported.md` | Modify | Document nested-`ta` support. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Author-facing note. |
| `.changeset/t2-nested-ta.md` | Create | minor (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**, incl. compile round-trip)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm skills:gate` (skill reference changed)

## Changeset

`.changeset/t2-nested-ta.md` — **minor** (`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- `31-nested-ta-arith` converts and **compiles** (round-trip green, not in
  `KNOWN_NON_COMPILING`).
- Nested `ta.*` emits `nested-ta-lowered`; a residual series emits
  `nested-ta-not-lowered` — never silent.
- KNOWN GAP prose removed; docs/diagnostics/skill updated; coverage + docs +
  readme + skills gates green; changeset committed.
