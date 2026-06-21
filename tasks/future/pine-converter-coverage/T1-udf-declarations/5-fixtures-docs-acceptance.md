# Task 5 — Fixtures, compile round-trip, Trend Wizard acceptance, docs/skills

> **Status: TODO**

## Goal

Lock UDF support behind the converter's golden + compile-round-trip harness,
prove the Trend Wizard helpers convert end-to-end, and land the docs / skills /
CLAUDE.md / changeset so the feature ships as one coherent PR. This is the
"make it real and keep it green" task for T1.

## Prerequisites

Tasks 1–4 (parse → semantic → pure emit → stateful inline). **T2** landed (the
inlined bodies need nested-`ta` `.current` lowering to compile).

## Current Behavior

- Converter fixtures are numbered triples under
  `packages/pine-converter/fixtures/`: `NN-name.pine` +
  `NN-name.expected.chart.ts` + `NN-name.expected.diagnostics.json`. The next
  free number is **31** (`30-explicit-plot-zorder` / `30-var-series-history`
  are the last two).
- `fixtures-compile.test.ts` (`src/tests/`) converts every fixture and, for
  clean conversions (no error diagnostic, output non-null, not in
  `KNOWN_NON_COMPILING`), compiles the output through
  `@invinite-org/chartlang-compiler` and asserts a non-empty module. UDF
  fixtures must round-trip — keep them OUT of `KNOWN_NON_COMPILING`.
- No fixture defines a Pine `=>` function today (confirmed by grep). Docs live
  in `docs/converter/{supported,rejects,diagnostics}.md` (the diagnostics page
  is generated); the author/integrator skills live under `skills/`.

## Desired Behavior

A representative set of UDF fixtures convert + compile cleanly, the Trend
Wizard helper cluster converts, and the supported/rejects/diagnostics docs +
CLAUDE.md describe UDF handling.

## Requirements

### 1. Fixtures (`packages/pine-converter/fixtures/`, numbers 31+)

Add triples (`.pine` + `.expected.chart.ts` + `.expected.diagnostics.json`),
each kept OUT of `KNOWN_NON_COMPILING`:

- `31-udf-pure-single-line` — `cf_limit(v, hi, lo) => math.max(math.min(v, hi),
  lo)`, called twice → reusable function (Task 3).
- `32-udf-pure-multi-line` — a pure multi-line helper with an intermediate
  local + implicit return.
- `33-udf-stateful-single-line` — `cf_slope(ma, n) => ta.ema(...)`, called
  once → inlined (Task 4), `udf-inlined` info.
- `34-udf-stateful-called-twice` — the **slot-isolation witness**: a stateful
  helper called with two different sources; the `.expected.chart.ts` shows two
  distinct inlined `ta.*` sites. Pair with a runtime/golden assertion (or a
  unit test in Task 4) that the two outputs diverge.
- `35-udf-multiline-stateful` — `cf_atr(length) => atr = ta.atr(length); (atr /
  close) * 100`, exercising intermediate local + nested-`ta` (T2) inside an
  inlined block.
- `36-udf-recursive-rejected` — a self-calling UDF → `udf-recursive-rejected`
  error (this one carries an error, so it is exempt from the compile
  round-trip; its `.expected.diagnostics.json` pins the reject).

### 2. Trend Wizard helper acceptance fixture

- `37-trend-wizard-helpers` — a trimmed but faithful slice of `Trend_Wizard.md`
  exercising the real helper cluster: `cf_slope`, `cf_dist`, `cf_ma`
  (a `switch`-expression body), `cf_atr_perct`, `cf_limit`, plus a couple of
  call sites each. It must convert + compile cleanly. This is the end-to-end
  proof T1 unblocks the script's computation core. (Parts needing T3–T8 — the
  table `get_dynamic_color`, MTF feeds — are out of THIS fixture's scope; keep
  it to the UDF surface.)

### 3. `fixtures-compile.test.ts`

- Confirm the new clean fixtures (31–35, 37) are NOT added to
  `KNOWN_NON_COMPILING`; the error fixture (36) is naturally skipped by the
  has-error guard.

### 4. Docs (`docs/converter/`)

- `supported.md` — add a "User-defined functions" section: single/multi-line
  `=>` decls; pure → reusable function, stateful → inlined per call site (with
  the slot-isolation rationale, one sentence); the implicit-last-expression
  return rule.
- `rejects.md` — recursive UDFs (`udf-recursive-rejected`), defaulted params
  (`udf-param-default-unsupported`), with the suggested rewrite.
- `diagnostics.md` — regenerated (it is auto-generated from `codes.ts`); ensure
  the new codes (`udf-typed-param-unsupported`, `udf-param-default-unsupported`,
  `udf-arity-mismatch`, `udf-recursive-rejected`, `udf-emitted-function`,
  `udf-inlined`, `udf-arg-hoisted`) render.

### 5. Skills (`skills/`)

- If the converter's skill (`skills/chartlang-setup/` integrator skill, which
  mirrors the compile/host/adapter + converter contract) enumerates supported
  Pine constructs, add UDFs. Run `pnpm skills:generate` and ensure the
  `skills:gate` passes (the repo rule: changing what a skill describes updates
  the skill in the same PR).

### 6. CLAUDE.md

- `packages/pine-converter/CLAUDE.md` — a "User-defined functions" invariants
  block consolidating the decisions from Tasks 1–4: the new statement form, the
  pure-vs-stateful split, transitive statefulness, evaluate-once arg hoisting,
  per-call-site slot isolation via inlining, and the recursion reject. (Tasks
  1–4 each touch CLAUDE.md for their slice; this task ensures the block reads
  coherently as a whole.)

### 7. Changeset

- `.changeset/pine-converter-udf.md` —
  `"@invinite-org/chartlang-pine-converter": minor`. One-paragraph summary:
  Pine user-defined function declarations now convert (pure → reusable
  function, stateful → inlined per call site for correct slot semantics).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/31..37-*.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | UDF + Trend Wizard helper fixtures. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify (if needed) | Keep clean UDF fixtures out of `KNOWN_NON_COMPILING`. |
| `docs/converter/supported.md` | Modify | UDF section. |
| `docs/converter/rejects.md` | Modify | Recursive / defaulted-param rejects. |
| `docs/converter/diagnostics.md` | Regenerate | New UDF codes. |
| `skills/chartlang-setup/**` | Modify | UDF support in the converter skill (if enumerated); `pnpm skills:generate`. |
| `packages/pine-converter/CLAUDE.md` | Modify | Consolidated UDF invariants block. |
| `.changeset/pine-converter-udf.md` | Create | `pine-converter` minor. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**;
  `fixtures-compile` round-trip green)
- `pnpm docs:check`
- `pnpm skills:generate` + `skills:gate` (if the skill surface changed)

## Changeset

`.changeset/pine-converter-udf.md` — **minor** (`pine-converter`).

## Acceptance Criteria

- Fixtures 31–35 + 37 convert AND compile cleanly (round-trip green, not in
  `KNOWN_NON_COMPILING`); 36 pins the recursion reject.
- The `34-udf-stateful-called-twice` witness shows two independent inlined
  `ta.*` sites and divergent state.
- `37-trend-wizard-helpers` proves the Trend Wizard helper cluster converts +
  compiles.
- Docs (supported/rejects/diagnostics) + CLAUDE.md + skill + changeset landed;
  all gates green.
