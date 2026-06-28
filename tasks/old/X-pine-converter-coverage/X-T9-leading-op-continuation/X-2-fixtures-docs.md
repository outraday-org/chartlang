# Task 2 — Fixtures, compile round-trip, docs/CLAUDE

> **Status: TODO**

## Goal

Lock the Task-1 lexer change behind fixture triples that round-trip through the
compiler, and update the lexer's documented line-continuation invariant. After
this task, multi-line leading-operator expressions are a tested, documented,
supported idiom.

## Prerequisites

- Task 1 (lexer leading-operator continuation) complete.

## Current Behavior

- Multi-line leading-operator conditions fail to parse (Task 1 evidence) — no
  fixture exercises them today (`grep -L` over
  `packages/pine-converter/fixtures/*.pine`).
- Fixtures are numbered triples under `packages/pine-converter/fixtures/`
  (`NN.pine` + `NN.expected.chart.ts` + `NN.expected.diagnostics.json`); the
  compile round-trip is `src/tests/fixtures-compile.test.ts` with the
  `KNOWN_NON_COMPILING` skip set. Use the next free `NN` (confirm against the
  dir — sibling TX tasks also add fixtures; do not hardcode a colliding number).
- `packages/pine-converter/CLAUDE.md` §Lexer documents the continuation rule as
  *"a paren-depth + trailing-comma rule, not lookahead"* — now out of date.

## Desired Behavior

- A fixture with multi-line `and`/`or` conditions (a faithful slice of MASM's
  long/short condition stack) converts to single-expression chartlang and
  **compiles** (out of `KNOWN_NON_COMPILING`).
- The CLAUDE.md lexer invariant describes the leading-operator continuation and
  its indentation/unary guard.

## Requirements

### 1. Fixture (`packages/pine-converter/fixtures/`)

Add `NN-leading-op-continuation.pine` (next free number):

```pine
//@version=6
indicator("Leading-op continuation", overlay=false)
sw = input.bool(true, "Switch")
a = close > open
b = ta.rsi(close, 14) > 50
cond = a and b
   and not sw
   and close > 0
entry = ma_ok
   or rsi_ok
   or (close > open ? a : b)
plot(cond ? 1 : 0)
plot(entry ? 1 : 0)
```

(Adjust `ma_ok`/`rsi_ok` to declared locals so the fixture is self-contained
and compiles.) Add the matching `.expected.chart.ts` (each `cond`/`entry` is a
single boolean expression) and `.expected.diagnostics.json` (no errors). Keep
it **OUT** of `KNOWN_NON_COMPILING` — it must round-trip and compile through
`src/tests/fixtures-compile.test.ts`.

### 2. Diagnostics

- This is a pure lexer behavior fix — **no new diagnostic code** is required
  (the success case simply parses). Confirm the previously-emitted
  `parse/unexpected-token` no longer fires for the fixture. If a new code is
  genuinely needed (e.g. an ambiguous continuation warning), APPEND it to
  `packages/pine-converter/src/diagnostics/codes.ts` (never reorder/rename) and
  ensure `code-coverage-grep.test.ts` passes.

### 3. CLAUDE.md (`packages/pine-converter/CLAUDE.md`)

- Update the §Lexer "Line continuation" invariant to a **three-part rule**:
  (1) suppressed while `parenDepth > 0`; (2) suppressed when the last
  significant token is a `,`; (3) suppressed when the next significant token is
  a leading infix operator on a line indented strictly deeper than the
  statement-start column (the unary `-`/`+` guard). Document the held-`newline`
  deferred-emit mechanism and explicitly frame it as **bounded one-token
  buffering** (the pending `newline` is resolved by the next significant token),
  NOT arbitrary lookahead — so the wording stays consistent with the prior "not
  lookahead" note rather than contradicting it. Note that the
  continuation-operator set is a shared constant kept in sync with
  `BINARY_PRECEDENCE`. Per the repo rule, a behavior change updates that
  folder's CLAUDE.md in the same PR.

### 4. Docs

- `docs/converter/supported.md`: add multi-line expressions (leading-operator
  continuation) to the supported-idiom list.
- `docs/converter/diagnostics.md` is generated — re-run its generator if any
  code changed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/NN-leading-op-continuation.pine` | Create | Fixture source. |
| `packages/pine-converter/fixtures/NN-leading-op-continuation.expected.chart.ts` | Create | Expected output. |
| `packages/pine-converter/fixtures/NN-leading-op-continuation.expected.diagnostics.json` | Create | Expected diagnostics (no errors). |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep `NN` out of `KNOWN_NON_COMPILING`. |
| `packages/pine-converter/CLAUDE.md` | Modify | Update §Lexer line-continuation invariant. |
| `docs/converter/supported.md` | Modify | Document multi-line continuation. |
| `.changeset/t9-leading-op-continuation.md` | Create | minor (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**, incl. compile round-trip)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/t9-leading-op-continuation.md` — **minor**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- The new fixture converts and **compiles** (round-trip green, not in
  `KNOWN_NON_COMPILING`); no `unexpected-token` for multi-line conditions.
- CLAUDE.md lexer invariant + `docs/converter/supported.md` updated; coverage +
  docs + readme gates green; changeset committed.
