# Trend Wizard Converter Cleanup

## Overview

Land a set of **general** Pine Script → chartlang converter
(`packages/pine-converter`) fixes — none are special-cased to a single
script. The **Trend Wizard v1.0** indicator (repo-root
`Trend_Wizard.md`) is used only as the real-world *forcing function*: a
large, feature-heavy Pine v6 script (multi-symbol `request.security`,
value-form and statement-form `switch`, a stateful on-chart table, ~150
grouped inputs) that today fails at the parse stage and cascades into
347 errors / 243 warnings, exercising every gap at once. After these
tasks any script using these constructs converts cleanly; Trend Wizard
is the manual end-to-end check, **not** a committed regression fixture
(the script will be removed from the repo afterward).

All findings here are **verified by reproduction**, not inferred. The
single source of truth for the diagnosis (exact files, line numbers,
reproduction commands, the non-issue) is
[`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) in this folder — read it
first.

Relevant contracts: root `CLAUDE.md` (skills/brand rules),
`packages/pine-converter/CLAUDE.md` (pipeline + diagnostics + naming
invariants), `packages/core/CLAUDE.md`, `packages/compiler/CLAUDE.md`.

## Current State

Converting `Trend_Wizard.md` today
(`node packages/cli/dist/bin.js pine-convert <file> --report`):

- **5 hard parse/transform errors** abort a clean conversion:
  1. `missing-version-directive` — two `//` license lines precede
     `//@version=6`.
  2. `switch-expression-unsupported` — `cf_ma` uses
     `float result = switch ma_type` (value-form switch).
  3. `expected-token` "Expected an indented block" — the
     `if barstate.islast` body's first line is a comment.
  4–5. two `unexpected-token` cascades — verified to be artifacts of
     the value-switch error recovery, **not** independent bugs.
- With the parse errors removed, the transform layer surfaces:
  `request-security-not-mapped` ×3 (input-bound symbol/timeframe),
  `non-literal-input-default` ×1 (the `input.timeframe("")` chart
  timeframe, mis-reported), `input-arg-not-mapped` ×228
  (`group`/`inline`/`tooltip`), `table-formatting-not-mapped` ×6, plus
  audit-only warnings (`history-on-non-series` ×7,
  `ta-signature-divergence` ×2, `color-transp-approximated` ×27,
  `table-bucket-cap-adjusted` ×1).

**Verified non-issue (no task):** statement-form `switch` with
comma-separated multi-assignment arms (`"A" => a := 1, b := 2`) parses
cleanly in isolation. The live `unexpected-token` was the value-switch
cascade (Task 2).

## Target State

- `Trend_Wizard.md` converts with **zero error-severity
  diagnostics**. Leading license comments are tolerated; value-form
  `switch` and comment-first blocks parse; the input-bound
  `request.security` feeds resolve through their input defaults;
  unmapped-arg noise is consolidated to one diagnostic per distinct
  arg name; remaining warnings are documented.
- New parser surface: leading-comment tolerance at the version
  directive and at indented blocks; a `SwitchExpression` AST node +
  Pratt rule + lowering.
- Extended compile-time security-feed extraction: an interval bound to
  an `input.interval` / `input.timeframe` default (and the empty =
  chart-timeframe case) is accepted as a feed, mirroring today's
  `input.symbol`-default support.
- Converter resolves identifier-bound symbol/timeframe feeds, maps
  `input.timeframe` → `input.interval`, accepts the `gaps=` arg, and
  consolidates unmapped-arg warnings.
- Every fix is covered by its own **small, script-agnostic** unit /
  property / golden fixtures in the converter package — the general
  behavior is regression-tested without depending on the Trend Wizard
  script. Trend Wizard itself is only a manual end-to-end check during
  development (`pine-convert Trend_Wizard.md --report` → `errors: 0`);
  it is **not** added as a committed fixture, since the script is being
  removed from the repo.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Tasks 1+2 fix the parser before anything else** | Parse errors abort the whole pipeline; the transform-layer tasks can only be exercised once the script parses. |
| **Leading-comment tolerance (version directive + block) is one task** | Both are the same root cause: `cursor` skips `comment` tokens but not the trailing `newline`. One shared, well-tested fix; two verification surfaces. |
| **Value-form `switch` gets a real `SwitchExpression` node, not a textual rewrite** | The converter is an AST→AST compiler; a proper expression node lets transform/codegen lower it like every other expression and removes the `rejectValueSwitch` guards (which also kills the two `unexpected-token` cascades). |
| **Variable feeds are resolved through the input *default*, not a new runtime-lazy-feed architecture** | Verified: the compiler already extracts `input.symbol` defaults as compile-time feeds. Trend Wizard's feeds are `input.symbol`/`input.timeframe`-bound, so they are compile-time-resolvable. True runtime-arbitrary feeds would need a compiler+runtime+host lazy-registration redesign — out of scope and unnecessary for this script. |
| **`input.timeframe("")` (empty) = chart timeframe** | Pine's empty timeframe means "chart timeframe". Map `input.timeframe`→chartlang `input.interval`; empty default = chart interval (omitted feed), not a "non-literal default" error. |
| **Unmapped-arg warnings consolidate to one-per-distinct-name** | 228 `input-arg-not-mapped` + 6 `table-formatting-not-mapped` is noise. core's input/table schema genuinely can't carry `group`/`inline`/`tooltip`/`text_font_family`/etc.; one informative diagnostic per arg name is the honest, low-noise contract. |
| **Audit warnings are triaged + documented, fixed only if a real semantic bug** | `history-on-non-series` / `ta-signature-divergence` may be correct lowerings; the task verifies semantics before changing behavior. |
| **No committed Trend Wizard golden fixture** | The script is being removed from the repo, so a script-specific regression fixture would rot. Each fix is regression-tested by its own small, general-purpose fixtures instead; Trend Wizard is only a manual end-to-end check. |

## Dependency Graph

```
Task 1 (parser: leading-comment tolerance)
Task 2 (parser: value-form switch)            ← 1 & 2 independent, both pure parser
   |
   v
Task 3 (core/compiler: input-bound interval feeds)
   |
   v
Task 4 (converter: input-bound request.security mapping + input.timeframe + gaps + tuple)
   |
   v
Task 5 (converter: consolidate unmapped-arg-name warnings)
   |
   v
Task 6 (converter: audit + document remaining warnings)
```

Each task is self-verifying via its own co-located, script-agnostic
tests. There is no final integration/fixture task — confirm the end
result by running `pine-convert Trend_Wizard.md --report` manually
(expect `errors: 0`) before the script is removed.

## Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Parser: tolerate leading comments before `//@version=6` and at the start of indented blocks](./1-parser-leading-comment-tolerance.md) | pine-converter | None | Low |
| 2 | [Parser: support value-form `switch` expressions](./2-parser-value-form-switch.md) | pine-converter | None | High |
| 3 | [Core/compiler: accept input-bound + chart-timeframe security feeds](./3-compiler-input-bound-interval-feeds.md) | core, compiler, runtime | 1, 2 | High |
| 4 | [Converter: map input-bound `request.security` feeds (symbol/timeframe + gaps + tuple)](./4-converter-input-bound-security.md) | pine-converter | 3 | High |
| 5 | [Converter: consolidate unmapped-arg-name warnings (inputs + tables)](./5-converter-consolidate-unmapped-args.md) | pine-converter | 4 | Medium |
| 6 | [Converter: audit + document remaining Trend Wizard warnings](./6-converter-audit-warnings.md) | pine-converter | 5 | Medium |

## Code Reuse

| What | Where | Use |
|------|-------|-----|
| Diagnostic registry | `packages/pine-converter/src/diagnostics/codes.ts` (`DIAGNOSTIC_CODE_ENTRIES`, `makeDiagnostic`) | Add/edit codes by key only; never inline the full string. |
| Token cursor + comment skipping | `packages/pine-converter/src/parser/cursor.ts` (`peek`, `skipComments`, `current`) | Tasks 1's newline-skip builds on this. |
| Statement-form switch parsing | `packages/pine-converter/src/parser/statements.ts` (`parseSwitchCase`, `parseSwitchStatement`) | Task 2 reuses arm-parsing for the expression form. |
| Security feed shape resolver | `packages/pine-converter/src/transform/securityShape.ts` (`resolveSecurityFeed`), `src/semantic/securityTuple.ts` | Task 4 extends the variable/identifier-resolution path. |
| Compile-time feed extraction | `packages/compiler/src/analysis/extractRequestedIntervals.ts` (`resolveOptString`) | Task 3 extends the interval branch to accept `input.interval`/`input.timeframe` defaults. |
| Input mapping table | `packages/pine-converter/src/mapping/inputs.ts` (`INPUT_MAP`), `src/transform/inputs.ts` | Tasks 4 & 5 — `input.timeframe`→`input.interval`, default handling, arg consolidation. |
| Table lowering | `packages/pine-converter/src/transform/tables.ts` (`UNMAPPED_CELL_ARGS`, `applyCellNamedArgs`) | Task 5 — consolidate `table-formatting-not-mapped`. |
| Golden fixture harness | `packages/pine-converter/fixtures/`, `src/tests/golden.test.ts`, `fixtures-compile.test.ts` | Tasks 1–6 add small, focused fixtures here; regenerate via `UPDATE_FIXTURES=1 pnpm test`. |
| Existing literal multi-symbol fixture | `packages/pine-converter/fixtures/32-request-security-multi-symbol.*` | Task 4 reference for the emitted feed shape. |

## Provenance

Not a port. The input artifact is `Trend_Wizard.md` (© TradeRational,
MPL-2.0) at the repo root, used as a real-world conformance target.

## Deferred / Follow-Up Work

- **Truly runtime-arbitrary security feeds** (symbol/interval that is
  neither a literal nor an input default — e.g. computed per bar):
  requires a compiler-validation relax + runtime lazy-feed lookup + a
  host/adapter dynamic-feed API. Out of scope; Trend Wizard does not
  need it. Capture as a separate epic if a future script requires it.
- **`text_formatting` / `text_font_family` / `text_wrap` table
  styling**: documented hard boundary (core `TableCell` has no
  analogue). Revisit only if core's table cell schema grows.
- **`group` / `inline` / `tooltip` input metadata**: revisit if core's
  `InputOptionsObject` ever carries UI-grouping fields.
- **`codegen/usage.ts` `state.` substring false-positive** (pre-existing, not
  introduced by these tasks): the import/destructure gate uses
  `corpus.includes("state.")`, which also matches `barstate.`, so a script
  that uses `barstate.*` but no real `state.*` slot emits a spurious (unused
  but harmless — still compiles) `state` import. The clean fix is the anchored
  `/\bstate\./` scan that the sibling `plot`/`hline`/`bgcolor` flags already
  use; it shifts 8 existing goldens (incl. unrelated tables/polyline/color
  fixtures 11/12/13/14/20/52), so it was deferred out of this scoped pass to
  avoid broad unrelated golden churn.
