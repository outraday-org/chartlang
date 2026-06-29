# Task 4 — Converter: map input-bound `request.security` feeds (symbol/timeframe + gaps + tuple)

> **Status: TODO**

## Goal

Teach the converter to map Trend Wizard's `request.security` calls,
whose symbol and timeframe come from **inputs**, not string literals:

```pine
string src_tframe = input.timeframe("", "Timeframe", group = menue_0, ...)
src_symbol_custom = input.symbol("NASDAQ:QQQ", "", group = menue_0, ...)
src_chart  = request.security(syminfo.tickerid,  src_tframe, close, gaps = barmerge.gaps_off)
src_custom = request.security(src_symbol_custom, src_tframe, close, gaps = barmerge.gaps_off)
[src_custom_hi, src_custom_lo] = request.security(src_symbol_custom, src_tframe, [high, low])
[atr_s, atr_m, atr_l] = request.security(src_symbol_custom, src_tframe, [cf_atr_perct(a), cf_atr_perct(b), cf_atr_perct(c)])
```

Resolve identifier-bound symbol/timeframe through their **input
declarations** (the compile-time-extractable defaults that Task 3 makes
the compiler accept), map `input.timeframe` → chartlang `input.interval`
(empty default = chart timeframe), accept the `gaps=` named arg, and
keep the already-working tuple/list output shape working with these
feeds.

See [`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Transform issues 4 & 5.

## Prerequisites

Task 3 (compiler accepts input-bound + chart-timeframe interval feeds).
Tasks 1–2 (script parses).

## Current Behavior

```bash
tail -n +4 Trend_Wizard.md > /tmp/tw.pine   # strip the 2 license lines for a focused run
node packages/cli/dist/bin.js pine-convert /tmp/tw.pine --report
# request-security-not-mapped ×3 (L199, L200, L203)
# non-literal-input-default ×1 (L7 — the input.timeframe("") declaration itself)
```

Root causes:
- `packages/pine-converter/src/transform/securityShape.ts`
  `resolveSecurityFeed` (~L103-120) only accepts `syminfo.tickerid` or a
  string-literal symbol, and a string-literal timeframe via
  `pineTimeframeToInterval`. An identifier bound to an input is
  rejected. `src/semantic/securityTuple.ts` (~L47-50) reuses it.
- `packages/pine-converter/src/transform/inputs.ts` default handling
  (~L200-229) rejects `input.timeframe("")` because `""` doesn't convert
  through `pineTimeframeToInterval` → mis-reported as
  `non-literal-input-default` even though `""` IS a literal (verified:
  fires even with a literal `group`).
- `gaps = barmerge.gaps_off` is an unmapped named arg on
  `request.security`.

## Desired Behavior

- `src_symbol_custom` / `src_tframe` (input-bound) resolve to their
  input declarations; the emitted chartlang `request.security` references
  the corresponding chartlang inputs (so the user can still change them),
  and the compiler (Task 3) accepts the resulting feed.
- `input.timeframe(...)` maps to chartlang `input.interval(...)`; default
  `""` = **chart timeframe** (no `non-literal-input-default`).
  `syminfo.tickerid` stays "chart symbol".
- `gaps = barmerge.gaps_off` (and `barmerge.gaps_on`) is recognized and
  mapped or safely dropped with at most one consolidated info — not a
  hard error. (Coordinate with Task 5's consolidation pattern; if Task 5
  lands the shared helper, reuse it; otherwise emit a single info here.)
- Tuple/list outputs (`[hi, lo]`, the 3-tuple of `cf_atr_perct(...)`)
  continue to work now that the feed resolves.

## Requirements

1. **Identifier→input resolution** in `resolveSecurityFeed`
   (`securityShape.ts`): when the symbol or timeframe arg is an
   identifier, resolve it (via the semantic scope / declaration table)
   to its `input.symbol` / `input.timeframe` / `input.interval`
   declaration and use the input as the feed source. If it resolves to
   a `var`/computed (non-input) value, keep rejecting with
   `request-security-not-mapped` (documented boundary — README Deferred).
   Apply the same in `src/semantic/securityTuple.ts` so tuple calls
   share the path.

2. **`input.timeframe` → `input.interval` default handling.** The
   `INPUT_MAP` row already maps `input.timeframe` → `input.interval`
   (`src/mapping/inputs.ts` ~L51-58) — do **not** re-add it. The actual
   bug is the **default** resolution: `resolveDefault` in
   `src/transform/inputs.ts` (~L200-229, `input.timeframe` branch ~L217-222)
   calls `timeframeDefault` → `pineTimeframeToInterval` (`""` returns
   `null`) → mis-fires `non-literal-input-default`. Fix the empty/chart
   case so `""` → chart timeframe representation (matching Task 3's
   representation), not a rejected default. A real non-literal default
   (computed expr) still errors with an **accurate** message.

3. **`gaps=` arg** on `request.security`. There is **no** `gaps=`
   handling today (verified). The model to follow is the existing
   `lookahead=` named-arg handler in
   `packages/pine-converter/src/transform/requestSecurity.ts` (~L115-118),
   which detects the arg by name and pushes a code. Add a `gaps=` branch
   there that recognizes `barmerge.gaps_off` / `barmerge.gaps_on`.
   chartlang's security feed is gap-filled by default; map `gaps_off`
   accordingly or drop with one info — don't leave it as a generic
   unmapped-arg error. (`ENUM_VALUE_MAP` lives in
   `src/mapping/enums.ts`, **not** in `requestSecurity.ts`; only touch it
   if you route the `barmerge.*` values through the shared enum table.)

4. **Manifest**: ensure `requiresBarInterval` / `drawingKindsUsed` and
   the emitted inputs/feeds in `ScriptScaffold` reflect the new feeds
   correctly (`src/codegen/manifest.ts`).

5. **Diagnostics**: reuse existing codes by key. If you add a code for
   the gaps/chart-tf info, add it to `DIAGNOSTIC_CODE_ENTRIES`
   (`src/diagnostics/codes.ts`) append-only and run
   `pnpm converter:docs:generate`.

## Edge Cases

- `syminfo.tickerid` symbol + input-bound timeframe (the `src_chart`
  call) → chart symbol at the input's timeframe; chart-tf empty default
  ⇒ effectively the primary series.
- Input-bound symbol + input-bound timeframe (the `src_custom` call).
- Tuple `[high, low]` and the 3-tuple of UDF calls
  (`cf_atr_perct(...)`) as the security expression — confirm the
  multi-return path still emits.
- `gaps_on` vs `gaps_off`.
- A `request.security` whose symbol/timeframe is a true `var`/computed →
  still `request-security-not-mapped`, with a clear message.
- The `src_symbol_swtch ? src_custom : src_chart` ternary that selects
  between the two feeds downstream (not in the security call itself, but
  verify it still lowers).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/securityShape.ts` | Modify | Identifier→input feed resolution. |
| `packages/pine-converter/src/semantic/securityTuple.ts` | Modify | Same resolution for tuple calls. |
| `packages/pine-converter/src/mapping/inputs.ts` | Reference | `input.timeframe`→`input.interval` row **already exists** (~L51-58); no change unless the default-shape needs it. |
| `packages/pine-converter/src/transform/inputs.ts` | Modify | Empty/chart-tf default (`resolveDefault`/`timeframeDefault` ~L200-229); accurate non-literal-default message. |
| `packages/pine-converter/src/transform/requestSecurity.ts` | Modify | `gaps=` arg handling, mirroring the `lookahead=` handler (~L115-118). |
| `packages/pine-converter/src/mapping/enums.ts` | Modify (only if routing via shared enum table) | `barmerge.gaps_off`/`gaps_on` value mapping. |
| `packages/pine-converter/src/codegen/manifest.ts` | Modify (if needed) | Feed/requiresBarInterval correctness. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify (if a new info) | Gaps/chart-tf info code, append-only. |
| `packages/pine-converter/src/**/*.test.ts` | Modify/Add | Unit + golden-style tests. |

## Tests (co-located, 100% coverage)

- Each of the 6 Trend Wizard security calls (above) → maps without
  `request-security-not-mapped`; emitted chartlang references the
  chartlang inputs and a valid feed.
- `input.timeframe("")` → maps to `input.interval` chart-tf, **no**
  `non-literal-input-default`.
- `gaps_off` / `gaps_on` recognized.
- Negative: `var x = "computed"` symbol → still rejects with the clear
  message.
- Round-trip: a focused fixture compiles through
  `@invinite-org/chartlang-compiler` (relies on Task 3).
- Property test over symbol×timeframe (literal / input-default /
  computed) shapes.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100%)
- `pnpm converter:docs:generate && pnpm converter:docs:check`
- `pnpm typecheck`, `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → `@invinite-org/chartlang-pine-converter`
**minor**: "Map input-bound `request.security` symbol/timeframe feeds,
`input.timeframe`→`input.interval` (incl. chart timeframe), and the
`gaps=` argument."

## Acceptance Criteria

- All 3 `request-security-not-mapped` and the 1
  `non-literal-input-default` gone from the full-script `--report`.
- 100% coverage; converter docs gate green; typecheck green.
- `packages/pine-converter/CLAUDE.md` updated (security subset invariant
  now includes input-bound feeds).
- `skills/chartlang-coding/references/translating-from-pine.md` updated
  (input-bound MTF feeds now supported).
- Changeset committed.
