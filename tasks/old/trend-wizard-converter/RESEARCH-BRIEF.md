# Trend Wizard converter gaps — verified research brief

Source script: `Trend_Wizard.md` (repo root), a Pine v6 "Trend Wizard v1.0"
indicator. Converted via `node packages/cli/dist/bin.js pine-convert <file>
--report`. All findings below are REPRODUCED, not inferred. Original-file line
numbers in parentheses; the `--report` run was done on a copy with the 2 leading
license-comment lines stripped, so its spans are -3 from the original.

## Verified blocker list (with isolation results)

### Parser (3 real fixes — these clear ALL parse errors incl. cascades)

1. **Leading comments/blank lines before `//@version=6`** → `missing-version-directive`.
   - Real TradingView Pine allows `//` comment + blank lines before the version directive.
   - Root cause: `src/parser/declarations.ts` `parseVersionDirective` (~L63-77) calls
     `cursor.match("version-directive")`. `cursor.peek()`/`skipComments` (src/parser/cursor.ts
     ~L68-78) skips `comment` tokens but NOT the `newline` tokens that follow comment-only
     lines, so it lands on a `newline` and fails the match.
   - Fix: skip leading `newline` tokens in `parseVersionDirective` before the match
     (mirror the same newline-skip pattern used for blocks — see #2).

2. **Indented block whose first line is a comment** → `expected-token` "Expected an indented block".
   - Hit by the `if barstate.islast and outputs` body which starts with `// Headers`
     (original L442, run L439).
   - Root cause: `src/parser/statements.ts` `parseBlock` (~L125-141) does `expect("indent")`,
     but after a comment-only first line the token stream is `comment, newline, indent, …`;
     `skipComments` drops the comment but leaves the `newline`, so `expect("indent")` fails.
   - Fix: skip leading `newline` tokens in `parseBlock` before `expect("indent")`.
   - NOTE: #1 and #2 share the SAME root cause (peek skips comments but not the trailing
     newline). Prefer a single robust fix (either both call sites, or fix at the cursor
     boundary `current()` in src/parser/cursor.ts ~L74-78 — but a cursor-level change ripples
     to every peek, so test thoroughly / 100% coverage).

3. **Value-form `switch` unsupported** (`float result = switch ma_type ...` in `cf_ma`,
   original L193, run L190) → `switch-expression-unsupported`.
   - Today only statement-form switch exists; value position is hard-rejected by
     `rejectValueSwitch` in `src/parser/statements.ts` (~L196-204), called from
     parseVariableDeclaration (L220), parseAssignment (L256), parseTupleDeclaration (L312).
   - There is NO `SwitchExpression` AST node (`src/ast/expressions.ts`); the Pratt parser
     (`src/parser/expressions.ts`) has no `switch` rule.
   - Fix: add `SwitchExpression` AST node, a Pratt prefix rule (reuse `parseSwitchCase`
     arm logic), remove the `rejectValueSwitch` guards, and lower in transform/codegen
     (chained ternary, or an IIFE/switch). Mirror how statement-form switch is lowered.
   - **This also clears the two `unexpected-token` cascades** at run L212 (orig L215) and
     run L448 (orig L451 EOF): they are NOT independent bugs — they're `rejectValueSwitch`'s
     `recoverCompound` mis-aligning the cursor in the full file. Verified: value-switch in
     isolation reproduces (1 error); statement comma-arm switch in isolation = 0 errors.

NON-ISSUE (verified, do NOT write a task): statement-form `switch` with comma-separated
multi-assignment arms (`"A" => a := 1, b := 2`) parses cleanly in isolation (0 errors across
3 faithful repros incl. string subject + mixed int/string `:=` arms + `var` targets). The
parser research hypothesis here was wrong; the live error was the #3 cascade.

### Transform / semantic (harder, judgment calls)

4. **`request.security` MTF subset too narrow** → `request-security-not-mapped` ×3
   (orig L202/L203/L206; run L199/L200/L203). The script uses:
   - non-literal (input-bound) **timeframe**: `src_tframe = input.timeframe("", …)` passed as the
     tf arg to `request.security(syminfo.tickerid, src_tframe, close, gaps = barmerge.gaps_off)`.
   - non-literal (input-bound) **symbol**: `src_symbol_custom = input.symbol("NASDAQ:QQQ", …)`.
   - **tuple/list output** with a non-literal feed: `[src_custom_hi, src_custom_lo] =
     request.security(src_symbol_custom, src_tframe, [high, low])` and a 3-tuple of
     function-call exprs (`[cf_atr_perct(...), …]`).
   - a `gaps = barmerge.gaps_off` named arg.
   - Root: `src/transform/securityShape.ts` `resolveSecurityFeed` (~L103-120) only accepts
     `syminfo.tickerid` or a string-literal symbol, and a string-literal timeframe that maps via
     `pineTimeframeToInterval`. `src/semantic/securityTuple.ts` (~L47-50) reuses it. Tuple/list
     SHAPE is already supported when the feed is literal; the blocker is the non-literal feed.
   - Decision needed: does chartlang/core support a runtime-variable symbol/interval feed? If
     yes → extend `resolveSecurityFeed` to a "variable feed" mode (symbol/tf resolved from an
     input/var) + handle `gaps=`. If not → graceful degradation (clear, actionable diagnostic +
     doc) rather than the current generic reject. Confirm against packages/core + compiler MTF
     support before implementing. This is the largest/riskiest task — may need a core change or
     an explicit "documented boundary" outcome.

5. **`input.timeframe("")` (empty = chart timeframe) rejected** as `non-literal-input-default`
   (orig L10, run L7). VERIFIED: even with a literal `group = "Table"`, `input.timeframe("", …)`
   errors. Root: the empty-string/chart-timeframe default doesn't convert through
   `pineTimeframeToInterval` (→ null → treated as "non-literal default"). The diagnostic
   message ("default value must be a compile-time literal") is MISLEADING here — `""` IS a literal.
   - Fix: at minimum, detect empty/chart-timeframe default and emit an accurate diagnostic
     (or support it as "chart timeframe"). Lives in `src/transform/inputs.ts` default handling
     (~L200-229 `resolveDefault` / timeframe path). Tied to #4 (the MTF feed family).

6. **Input metadata noise** → `input-arg-not-mapped` warning, 228 occurrences (every input uses
   `group=`, `inline=`, `tooltip=`; some `confirm=`). chartlang's core `InputOptionsObject`
   supports only `title/min/max/step/multiline` — no group/inline/tooltip/confirm.
   - Root: `src/transform/inputs.ts` `buildOptions` (~L130-173, L166) + `resolveOptionsEnum`
     (~L383-388) push one warning PER unmapped arg PER call.
   - Fix: consolidate to ONE diagnostic per distinct unmapped arg NAME across the whole script
     (collect a Set during the input walk, emit once at end). 228 → ~4. Confirm with core whether
     any of these can actually be mapped (research says no); if not, the consolidated message
     should say so. Keep severity info/warning per the codes registry rules.

7. **Table styling noise** → `table-formatting-not-mapped` warning ×6 (`text_font_family`,
   `text_formatting`/bold, `text_wrap` on `table.cell`). chartlang `TableCell` supports
   text/bgColor/textColor/textHalign/textValign/textSize only. The script's `table.new` +
   dynamic `bgcolor`/`text_color` DO map.
   - Root: `src/transform/tables.ts` `UNMAPPED_CELL_ARGS` (~L88-92), `applyCellNamedArgs`
     (~L236-239) warns per cell per arg.
   - Fix: consolidate to one warning per distinct unmapped cell-arg name; confirm the dynamic
     bgcolor/text_color path still emits correctly. These three are a documented hard boundary.

### Quality audit (warnings — decide real vs acceptable, document each)

8. Remaining non-blocking diagnostics to triage and DOCUMENT (in the fixture's expected
   diagnostics + brief), not necessarily "fix":
   - `history-on-non-series` ×7 (orig L279-284, e.g. `ma_cross[1] or ma_cross[2]` history on a
     local bool inside `cf_macross`, and `ma_*_slope[1]` derivatives). Confirm these are correct
     warnings (Pine allows history on locals; chartlang may need a state slot) — verify the
     emitted code is still semantically correct or flag as a real gap.
   - `ta-signature-divergence` ×2 (orig L177 `cf_dist` → `ta.sma`). Confirm the lowering matches
     Pine semantics.
   - `color-transp-approximated` ×27 and `table-bucket-cap-adjusted` ×1: informational, expected.

### Integration

9. End-to-end verification only — NO committed Trend Wizard fixture (the script is being removed
   from the repo, so a script-specific golden would rot). Each fix above ships its own small,
   script-agnostic golden/unit/property fixtures so the GENERAL behavior is regression-tested.
   As the final manual check, run `node packages/cli/dist/bin.js pine-convert Trend_Wizard.md
   --report` and confirm `errors: 0` with the residual warnings = the audited set. (Keep the
   leading license comments in any ad-hoc run to exercise fix #1.)

## Landing contract (every converter change must satisfy)

- Pipeline stays Lex→Parse→Semantic→Transform→Codegen; stages never throw, only push diagnostics.
- Diagnostic codes: add/edit ONLY via `DIAGNOSTIC_CODE_ENTRIES` in `src/diagnostics/codes.ts`
  (short kebab key; full code `pine-converter/{stage}/<slug>`); append-only, never rename/reorder;
  reference by key, never inline the string. New/changed codes ⇒ run `pnpm converter:docs:generate`
  (auto-writes `docs/converter/diagnostics.md`); `pnpm converter:docs:check` gates drift.
- 100% coverage (lines/statements/branches/functions) — `packages/pine-converter/vitest.config.ts`.
  Parser-unreachable defensive arms get `*.synthetic.test.ts`; use `*.property.test.ts` (fast-check)
  where shapes vary.
- Golden fixtures: `NN-name.pine` + `.expected.chart.ts` + `.expected.diagnostics.json`; tests in
  `src/tests/golden.test.ts` (+ `.strict`, `.determinism`, `fixtures-compile.test.ts`).
  Regenerate via `UPDATE_FIXTURES=1 pnpm test` (deterministic: barInterval 60_000,
  barIndexOrigin 1_700_000_000_000).
- Naming: generated identifiers route through `ScriptScaffold.names: NameAllocator`; no `__` prefix
  (only `__barIndexBridge()` sentinel).
- Skills: if the converter's user-facing surface/camp rules change, update
  `skills/chartlang-coding/references/translating-from-pine.md` (hand-authored). Diagnostics docs are
  auto-generated; no skills:generate needed for converter diagnostics.
- Changeset required: `pnpm changeset` → `@invinite-org/chartlang-pine-converter` (semver per change).
- Per-folder CLAUDE.md: update `packages/pine-converter/CLAUDE.md` if an invariant changes.

## Commands

- Build CLI for manual repro: `pnpm --filter @invinite-org/chartlang-pine-converter build`
  then re-run via `node packages/cli/dist/bin.js pine-convert …` (rebuild CLI too if its dist is stale).
- Tests: `pnpm --filter @invinite-org/chartlang-pine-converter test`
- Update goldens: `cd packages/pine-converter && UPDATE_FIXTURES=1 pnpm test`
- Diagnostics docs: `pnpm converter:docs:generate` / `pnpm converter:docs:check`
- Full gate: `pnpm check:content`
- Manual repro of the source: `cp Trend_Wizard.md /tmp/tw.pine && node packages/cli/dist/bin.js
  pine-convert /tmp/tw.pine --report`
