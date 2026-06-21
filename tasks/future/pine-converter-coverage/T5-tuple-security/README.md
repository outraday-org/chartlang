# T5 — Converter: tuple-returning `request.security`

## Overview

Support Pine's **tuple form** of `request.security`, where a single call
returns multiple series destructured into a tuple. Trend Wizard uses it twice:

```pine
[src_custom_hi, src_custom_lo] = request.security(src_symbol_custom, src_tframe, [high, low])
[atr_short_custom, atr_med_custom, atr_long_custom] =
    request.security(src_symbol_custom, src_tframe, [cf_atr_perct(a), cf_atr_perct(b), cf_atr_perct(c)])
```

This sits on top of `../multi-symbol-security/` (custom-symbol feeds) — T5 adds
the **tuple** shape specifically.

## Current State (evidence — ran built converter)

Pine `[h, l] = request.security(syminfo.tickerid, "D", [high, low])` →
`pine-converter/parse/expected-token`, `unexpected-token`, and
`pine-converter/transform/multi-return-not-mapped`. Output emits nothing
usable (`bar.high;` leaked, `plot(h - l)` references undefined names).

- Per `packages/pine-converter/CLAUDE.md`: *"`request.security`/MTF
  multi-return is still out of scope (its RHS isn't a recognised multi-output
  `ta.*`, so it warns `multi-return-not-mapped`)."*
- Tuple-LHS (`[a,b] = …`) **is** parsed for multi-output `ta.*`
  (`MULTI_RETURN_TA_MAP`, `src/transform/other.ts` `emitTupleDeclaration`),
  but `request.security` is not a recognized multi-output source.
- The `[high, low]` / `[expr, expr, expr]` **array literal** as the 3rd arg
  also stresses array-literal parsing (see T4).

## Target State

- `[a, b] = request.security(sym, tf, [s1, s2])` lowers to N independent
  reads (one per tuple element), reusing the data form for OHLCV fields
  (`request.security({ symbol, interval }).high` / `.low`) and the callback
  form for computed expressions
  (`request.security({ symbol, interval }, (bar) => <expr>)`).
- Each element binds its own chartlang scalar/series; downstream uses
  (`src_custom_hi`, etc.) resolve correctly.
- Honor the multi-symbol literal-symbol + literal/enum-interval constraints
  from `../multi-symbol-security/`.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Split tuple into N single reads | chartlang has no native multi-series `request.security` return; N calls is the clean lowering. Each computed-expr element uses the callback form (runs on the HTF clock — the correct Pine semantics). |
| Share alignment | All N reads use the same `{ symbol, interval }`; the runtime aligns each on timestamp (no lookahead) per multi-symbol-security. |
| OHLCV vs. expression element | A bare `high`/`low`/… element → data-form field; any other expression → callback form (mirror `requestSecurity.ts`'s 3rd-arg dispatch). |
| `cf_atr_perct(...)` elements | Require **T1** (UDF) + **T2** (nested `ta.*`) since the element is a stateful helper call. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `request.security` 3rd-arg dispatch | `src/transform/requestSecurity.ts` | Per-element data/callback selection. |
| Tuple-decl lowering | `src/transform/other.ts` (`emitTupleDeclaration`, `registerTupleFields`) | Bind N element names. |
| Multi-symbol opts/manifest | `../multi-symbol-security/` tasks | Symbol field, capability gate, alignment. |
| Array-literal parse | see **T4** | Parse the `[…]` source-list arg. |

## Dependencies

- **`../multi-symbol-security/`** (custom-symbol reads) — hard dependency.
- **T1 + T2** for the computed-expression (`cf_atr_perct`) tuple.
- **T4** array-literal parsing for the `[…]` 3rd arg.

## Dependency Graph

```
../multi-symbol-security/ (feeds + opts)   T4 (array-literal parse)
                       \                   /
                        v                 v
Task 1 (parse tuple-LHS request.security + [...] source list; classify elements)
  |
  v
Task 2 (lower to N reads + bind names + fixtures + docs)   ← computed-expr
                                                              fixture gated on T1+T2
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Parse tuple-LHS `request.security` + `[…]` source list](./1-parse-tuple-security-and-source-list.md) | pine-converter | T4, `../multi-symbol-security/` | Medium |
| 2 | [Lower to N reads + fixtures + docs](./2-lower-to-n-reads-fixtures-docs.md) | pine-converter | 1 (+ T1, T2 for computed-expr) | Medium |

## Acceptance Criteria

- Both Trend Wizard tuple-`request.security` lines convert to compiling
  chartlang with correct per-element values.

## Deferred / Follow-Up

- `barmerge.gaps_*` / `lookahead` args (Trend Wizard uses `gaps_off`, the
  default-aligned behavior) — map or drop-with-note per multi-symbol-security.
