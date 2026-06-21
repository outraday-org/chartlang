# Task 2 — Lower tuple `request.security` to N reads + fixtures + docs

> **Status: TODO**

## Goal

Emit the chartlang for a tuple `request.security`: lower each classified
element (Task 1) into its own `request.security` read — the **data form** for
OHLCV fields, the **callback form** for computed expressions — bind each tuple
name to its read, register the names so downstream references resolve, and ship
the fixture triple + compile round-trip + docs/skill updates.

## Prerequisites

- T5 Task 1 (parse + classify).
- For the computed-expression tuple (`cf_atr_perct(...)`): **T1** (UDF
  declarations) and **T2** (nested `ta.*` `.current`) — the element body is a
  stateful helper call. Without them, the OHLCV tuple (`[high, low]`) still
  lands; gate the computed-expr fixture behind T1/T2.

## Current Behavior

- `src/transform/other.ts` lowers a recognised multi-output `ta.*` tuple via
  `emitTupleDeclaration` + `registerTupleFields` (binds each element to
  `<result>.<field>.current` through `EmitContext.tupleFieldAliases`).
- `src/transform/requestSecurity.ts` emits a **single** `request.security`:
  data form `request.security({ symbol, interval }).<field>` for an OHLCV
  source, callback form `request.security({ symbol, interval }, (bar) => <expr>)`
  otherwise.
- No path emits N reads from one tuple `request.security` (Task 1 produced the
  IR; nothing consumes it yet).

## Desired Behavior

```ts
// [src_custom_hi, src_custom_lo] = request.security(sym, "D", [high, low])
const src_custom_hi = request.security({ symbol: "NASDAQ:QQQ", interval: "1d" }).high;
const src_custom_lo = request.security({ symbol: "NASDAQ:QQQ", interval: "1d" }).low;

// [a, b, c] = request.security(sym, "D", [cf_atr_perct(x), …])  (needs T1+T2)
const a = request.security({ symbol: "NASDAQ:QQQ", interval: "1d" }, (bar) => /* inlined cf_atr_perct(x) */);
// …b, c likewise
```

Each tuple name binds to its own read; later uses (`src_custom_hi - src_custom_lo`,
the ATR selections) compile.

## Requirements

### 1. Emit one read per element

- For a `securityTuple` declaration, iterate its N classified elements and emit
  one chartlang statement per element via the existing `requestSecurity.ts`
  emitters:
  - `{ kind: "ohlcv", field }` → data form `…({ symbol, interval }).<field>`,
  - `{ kind: "expr", node }` → callback form `…({ symbol, interval }, (bar) => <emitted node>)`,
    with the source's OHLCV reads mapped to `bar.*` (reuse the existing field
    mapper) and nested `ta.*` lowered per **T2**.
- All N reads share the **same** `{ symbol, interval }` opts object literal
  (one feed; the runtime dedups via `feedKey` per multi-symbol-security).
- **Manifest coordination.** Ensure the tuple feed is picked up by
  `../multi-symbol-security/`'s feed extraction (its
  `extractRequestedIntervals`/`requestedFeeds` manifest pass) so the
  `securityTuple` declaration's `{ symbol, interval }` is registered like a
  single-source `request.security` — otherwise the runtime has no feed to route
  and the tuple reads silently resolve to nothing. If multi-symbol's extraction
  only walks single `request.security` calls, this task extends it to also walk
  `securityTuple`-annotated `TupleDeclaration` nodes.

### 2. Bind names + register

- Bind each non-`_` tuple name to its read result (a `const <name> = …`), in
  source order. Register through the same mechanism `registerTupleFields` uses
  so `EmitContext` rewrites later references correctly (no `<result>.field`
  indirection here — each name is its own const).
- A `_` placeholder element emits the read for side-effect ordering only if it
  has one; otherwise skip (Pine `_` is discarded).
- **Out of scope (known gap):** tuple-element `:=` reassignment
  (`[a, b] := request.security(...)` rebinding existing names) is NOT supported
  in v1 — only `[a, b] = …` declarations. This mirrors the existing
  `emitTupleDeclaration` limitation (CLAUDE.md notes a tuple-decl element
  reassigned with `:=` is unsupported). Note it; do not attempt to handle it.

### 3. Scalar vs series context

- A tuple element consumed in scalar arithmetic gets `.current` (mirror the
  single-source `mtf-series-to-scalar-conversion` info in
  `requestSecurity.ts`); keep the series where a chartlang API wants a `Series`.

### 4. Fixtures (`packages/pine-converter/fixtures/`)

- `NN-security-tuple-ohlcv.{pine,expected.chart.ts,expected.diagnostics.json}` —
  the `[high, low]` data-form tuple (no T1/T2 needed). Must pass the compile
  round-trip in `src/tests/fixtures-compile.test.ts`.
- `NN-security-tuple-expr.{pine,…}` — the computed-expr tuple; add to
  `KNOWN_NON_COMPILING` **only** until T1+T2 land, with a comment pointing at
  them, then remove.

### 5. Docs + skill + CLAUDE.md

- `docs/converter/supported.md` — add the tuple `request.security` row.
- `docs/converter/diagnostics.md` (generated) — the two new codes from Task 1.
- `skills/chartlang-coding/references/translating-from-pine.md` — tuple-MTF
  mapping example.
- `packages/pine-converter/CLAUDE.md` — document the N-reads lowering + shared
  opts object.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` | Modify | Consume `securityTuple` IR; emit N reads + bind names. |
| `packages/pine-converter/src/transform/requestSecurity.ts` | Modify | Reuse data/callback emitters per element; share opts literal. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify (if needed) | Register tuple-name bindings. |
| `packages/pine-converter/fixtures/NN-security-tuple-ohlcv.*` | Create | OHLCV tuple fixture triple. |
| `packages/pine-converter/fixtures/NN-security-tuple-expr.*` | Create | Computed-expr tuple fixture triple. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Round-trip (expr fixture gated on T1/T2). |
| `docs/converter/supported.md` | Modify | Tuple-security row. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Mapping example. |
| `packages/pine-converter/CLAUDE.md` | Modify | N-reads lowering invariant. |
| `.changeset/converter-tuple-security.md` | Create | patch (pine-converter). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage; fixture
  compile round-trip green)
- `pnpm docs:check`, `pnpm readme:check`
- `pnpm skills:gate` (skill reference changed)

## Changeset

`.changeset/converter-tuple-security.md` — **patch**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- `[high, low] = request.security(sym, tf, [high, low])` converts to two data
  reads that compile; `src_custom_hi - src_custom_lo` resolves.
- The computed-expr tuple converts to N callback reads once T1+T2 land (fixture
  un-gated then).
- All N reads share one `{ symbol, interval }` literal; docs/skill/CLAUDE
  updated; coverage + gates green; changeset committed.
