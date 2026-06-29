# Task 6 — Converter: audit + document remaining Trend Wizard warnings

> **Status: TODO**

## Goal

With the errors gone (Tasks 1–4) and the noise consolidated (Task 5),
**triage every remaining warning/info** the converter emits for
Trend Wizard, confirm each is either *correct* (an honest, semantically
faithful note) or a *real semantic bug*, and **document** the verdict.
Fix only the ones that are genuine bugs; document the rest as expected.
This is the final task — it also runs the manual end-to-end check on the
forcing-function script before that script is removed from the repo.

See [`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Quality audit.

## Prerequisites

Task 5 (so the diagnostic set is stable and de-noised).

## Current Behavior

After Tasks 1–5, the residual diagnostics for the full script are
expected to be (verified pre-task counts):

| Code | Count | Where | Initial read |
|------|-------|-------|--------------|
| `history-on-non-series` | 7 | `cf_macross` `ma_cross[1] or ma_cross[2]` (bool history); `ma_*_slope[1]` derivatives (L279-284) | Pine allows `[n]` history on locals; chartlang may need a state slot. **Verify the emitted code is semantically correct.** |
| `ta-signature-divergence` | 2 | `cf_dist` → `ta.sma` (L177) | Confirm the lowering matches Pine `ta.sma` semantics. |
| `color-transp-approximated` | 27 | `color.rgb(r,g,b,transp)` calls | Informational; transparency approximated. Expected. |
| `table-bucket-cap-adjusted` | 1 | table sizing | Informational. Expected. |

Reproduce:

```bash
node packages/cli/dist/bin.js pine-convert /tmp/tw.pine --diagnostics-json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const c={};for(const d of j){const k=d.code.split("/").pop();c[k]=(c[k]||0)+1}console.log(c)})'
```

## Desired Behavior

- Every residual warning/info is classified: **correct-and-expected**
  (keep, document) or **real-bug** (fix in this task with a test).
- The `history-on-non-series` cases are the priority: confirm the
  emitted chartlang preserves Pine semantics for (a) boolean history
  inside `cf_macross` and (b) the `ma_*_slope[1]` first-difference
  derivatives. If history on a non-series local silently drops the
  history (wrong value), that's a **bug** — fix the lowering (likely a
  state slot) or, if truly unsupported, upgrade to an accurate
  error rather than a misleading warning.
- `ta-signature-divergence` for `cf_dist`/`ta.sma`: confirm arg order /
  semantics; fix if divergent, else document why the divergence note is
  acceptable.
- `color-transp-approximated` and `table-bucket-cap-adjusted`: document
  as expected; no code change.

## Requirements

1. **Audit, don't guess.** For each `history-on-non-series` site, read
   the emitted chartlang (`--out /tmp/tw.chart.ts`) and trace whether
   the historical value is preserved. Use a minimal repro per pattern
   (boolean `[1]/[2]`, slope `[1]`). Decide: correct / bug.

2. **Fix genuine bugs only.** If a history case is wrong, implement the
   correct lowering (state slot / series) in the relevant transform
   module, with unit + property tests and 100% coverage. If a case is
   unsupportable, replace the warning with an **accurate** diagnostic
   (new code via `DIAGNOSTIC_CODE_ENTRIES` if needed, append-only, then
   `pnpm converter:docs:generate`).

3. **Document the verdicts.** Add a short "residual diagnostics" note to
   `packages/pine-converter/CLAUDE.md` (framed generally, by diagnostic
   code — not as a one-script writeup) listing each residual code, why
   it is expected, and the workaround/limitation, so future maintainers
   don't re-investigate.

4. **No scope creep.** Do not "fix" `color-transp-approximated` /
   `table-bucket-cap-adjusted` — they are informational by design.

5. **Final end-to-end check (this is the last task).** With Tasks 1–6
   landed, run the forcing-function script manually and confirm a clean
   conversion before it is removed from the repo:

   ```bash
   node packages/cli/dist/bin.js pine-convert Trend_Wizard.md --report
   # expect: errors: 0  (residual warnings/infos = the audited set above)
   ```

   This is a manual confirmation only — do **not** add `Trend_Wizard`
   as a committed fixture (the script is being removed). The general
   behavior is already regression-tested by the small fixtures added in
   Tasks 1–6.

## Edge Cases

- Boolean history (`ma_cross[1] or ma_cross[2]`) vs numeric series
  history (`ma_1_slope - ma_1_slope[1]`) may have different correctness
  outcomes — audit separately.
- `ta-signature-divergence` may be a deliberate, documented note
  (chartlang `ta.sma` vs Pine `ta.sma` warmup/arg differences) — confirm
  against the TA mapping tables before "fixing".
- Any fix must not regress existing golden fixtures
  (`UPDATE_FIXTURES=1 pnpm test` only if intended).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/*.ts` | Modify (only if a real bug) | Correct history/ta lowering. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify (only if a new accurate code) | Append-only. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document residual diagnostics + verdicts (by code, general). |
| `packages/pine-converter/src/**/*.test.ts` | Modify/Add | Tests for any fix; repro tests for verdicts. |

## Tests (co-located, 100% coverage)

- A focused test per audited pattern asserting the verdict (correct
  lowering preserved, or the bug fix produces the right series).
- If a code/message changed, golden + strict + determinism suites green.
- 100% line/branch/function maintained.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100%)
- `pnpm converter:docs:generate && pnpm converter:docs:check` (if codes
  changed)
- `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → `@invinite-org/chartlang-pine-converter`
**patch** (or **minor** if a real semantic fix changes output):
"Audit Trend Wizard residual diagnostics; fix <…> / document the rest."

## Acceptance Criteria

- Every residual warning/info has a written verdict in
  `packages/pine-converter/CLAUDE.md`.
- Any genuine semantic bug is fixed with tests; informational notes left
  intact.
- 100% coverage; docs gate green (if codes changed).
- Final manual end-to-end check passes:
  `pine-convert Trend_Wizard.md --report` → `errors: 0`, residual
  warnings = the audited set.
- Changeset committed. **This completes the folder** — the converter now
  handles these constructs generally; no committed Trend Wizard fixture.
