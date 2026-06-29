# Task 1 — Parser: tolerate leading comments before `//@version=6` and at the start of indented blocks

> **Status: TODO**

## Goal

Make the parser tolerate `comment` / blank lines (a) before the
`//@version=6` directive and (b) as the first line of an indented
block. Both are the **same root cause** and fix together: the cursor
skips `comment` tokens but not the `newline` that follows a
comment-only line, so a peek lands on the stray `newline` and the
match for `version-directive` / `indent` fails.

See [`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Parser issues 1 & 2.

## Prerequisites

None.

## Current Behavior

```
// license line
// credit line
//@version=6
indicator("x")
```
→ `error[missing-version-directive]` at the end of the first comment
line.

```
if barstate.islast
    // Headers
    table.cell(...)
```
→ `error[expected-token]: Expected an indented block.` at the comment.

Reproduce:

```bash
cp Trend_Wizard.md /tmp/tw.pine
node packages/cli/dist/bin.js pine-convert /tmp/tw.pine --report
# observe: missing-version-directive (L1) and expected-token (L442)
```

## Desired Behavior

- Leading `comment` and blank lines before `//@version=6` are skipped;
  the directive is found. (Real TradingView Pine allows this.)
- An indented block whose first physical line is a comment parses; the
  `indent` is found after the comment + its newline.
- A genuinely missing version directive / genuinely missing block still
  produce `missing-version-directive` / `expected-token` respectively
  (no regression — the diagnostics must still fire when there really is
  no directive / no indented body).

## Requirements

1. **Token model confirmation.** In `packages/pine-converter/src/lexer/lex.ts`
   (~L167-176, L236-240) comment-only / blank lines emit a `newline`
   token immediately and do **not** touch the indent stack — this is
   correct, keep it. The fix is in the parser, not the lexer.

2. **Version directive** — `packages/pine-converter/src/parser/declarations.ts`,
   `parseVersionDirective` (~L63-77). Before `cursor.match("version-directive")`,
   skip leading `newline` tokens (the cursor already auto-skips
   `comment`). Example shape:

   ```ts
   while (ctx.cursor.peekKind() === "newline") {
     ctx.cursor.next();
   }
   const token = ctx.cursor.match("version-directive");
   ```

   Confirm `peekKind()` / `next()` exist on the cursor
   (`src/parser/cursor.ts`); if the public surface differs, use the
   equivalent (`peek().kind` + advance). Do **not** consume non-newline
   tokens.

3. **Indented block** — `packages/pine-converter/src/parser/statements.ts`,
   `parseBlock` (~L125-141). Apply the same leading-`newline` skip
   before `cursor.expect("indent")`.

4. **Shared helper (preferred).** Rather than duplicating the loop,
   add a small cursor method (e.g. `skipNewlines()`) on
   `src/parser/cursor.ts` and call it from both sites, OR a parser-local
   helper. Keep it minimal and covered. **Do not** change the cursor's
   `current()`/`skipComments()` to swallow newlines globally — that
   ripples to every peek (history `[1]`, line-continuation, switch
   arms) and risks broad regressions; keep the skip explicit at the two
   call sites.

5. **No new diagnostic codes.** This task only changes when existing
   codes fire. Do not add to `DIAGNOSTIC_CODE_ENTRIES`.

## Edge Cases

- Blank lines (not just comments) before the directive / block.
- A comment-only line **between** two real statements inside a block
  (must still parse; the existing skip handles mid-block, verify).
- A file that is *only* comments (no directive) → still
  `missing-version-directive`.
- An `if`/`for`/`switch`/function body that is genuinely empty (no
  indent at all) → still `expected-token`.
- Windows CRLF newlines if the lexer distinguishes them (check
  `lex.ts`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/parser/cursor.ts` | Modify | Add `skipNewlines()` (or equivalent) helper. |
| `packages/pine-converter/src/parser/declarations.ts` | Modify | Skip leading newlines in `parseVersionDirective`. |
| `packages/pine-converter/src/parser/statements.ts` | Modify | Skip leading newlines in `parseBlock`. |
| `packages/pine-converter/src/parser/*.test.ts` (existing parser tests) | Modify/Add | Unit cases for both surfaces + no-regression cases. |

## Tests (co-located, 100% coverage)

- Leading 1+ comment lines and blank lines before `//@version=6` →
  parses, zero diagnostics.
- `if cond` block whose first line is a comment → parses, body contains
  the real statement.
- Negative: no directive at all → `missing-version-directive` still
  fires. Empty indented body → `expected-token` still fires.
- Cover the new helper's branch (newline present / absent) to keep the
  package at 100% line/branch/function.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% coverage)
- `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → `@invinite-org/chartlang-pine-converter`
**patch**: "Tolerate leading comments/blank lines before the version
directive and at the start of an indented block."

## Acceptance Criteria

- Both reproductions above no longer emit their respective errors.
- No-regression negatives still fire.
- 100% coverage maintained; typecheck green.
- Reproduction delta on the full script: `missing-version-directive`
  (L1) and `expected-token` (L442) gone from the `--report` output.
- Changeset committed.
