# Task 7 — Coordinate resolver — Validated Plan

## Context

Bridge Pine's bar-index coordinate model to chartlang's absolute
`(time, price)` `WorldPoint`s. A package-internal `resolveCoordinates`
produces a side-table mapping every coordinate-bearing expression (the
args to `line.new`/`label.new`/`box.new`/`polyline.new` and every
`chart.point.*` factory call) to a `ResolvedAnchor` IR that Task 16's
codegen renders verbatim. The resolver does NOT rewrite the AST. It
also ships a Pine-expr → chartlang-TS-string mini-emitter (`exprEmit`)
and the OHLCV/`na`/`bar_index` `BUILTIN_IDENTIFIER_MAP`.

## Pre-existing work (verified against the workspace)

- `src/transform/index.ts` is the `export {};` stub — I re-export the
  resolver here.
- `src/mapping/index.ts` re-exports five tables (`drawingKinds`,
  `enums`, `inputs`, `taPassthrough`, `mathPassthrough`) — I append a
  `builtinIdentifiers` re-export.
- `src/diagnostics/codes.ts` holds the typed `DIAGNOSTIC_CODES` registry
  + `makeDiagnostic(key, span, msg?)`. I APPEND four codes; I do NOT
  reorder existing ones. Note: `ParserDiagnosticCode = keyof typeof
  DIAGNOSTIC_CODES` already widens to every key, so the new codes are
  usable by `makeDiagnostic` with no signature change.
- Semantic output is `SemanticResult` (`src/semantic/types.ts`) — there
  is **no `AnnotatedScript` type** (task file is inaccurate). It carries
  `script`, `annotations: ReadonlyMap<AstNode, SemanticAnnotation>`
  (holds per-node `naKind`), `drawingSites: readonly DrawingCallSite[]`,
  `drawingClassifications`, `referencesBarIndex`,
  `referencesFutureBarIndex`, `diagnostics`.
- core anchor type (verified `packages/core/src/draw/worldPoint.ts`):
  `WorldPoint = { readonly time: Time; readonly price: Price }`. The
  resolver only TARGETS the textual `{ time, price }` shape via emitted
  strings — it does not import `WorldPoint` (no value-level use), so
  `core` stays a devDependency-only cross-check (matching the mapping
  precedent).
- AST shapes verified (`src/ast/expressions.ts`):
  `IdentifierExpression{name}`, `LiteralExpression{literalKind,value}`,
  `NaExpression`, `UnaryExpression{operator,operand}`,
  `BinaryExpression{operator,left,right}`, `TernaryExpression`,
  `CallExpression{callee,args:CallArgument[]}`,
  `MemberAccessExpression{head,chain}` (bare-root chain → `head:null`,
  dotted names in `chain`), `HistoryAccessExpression{receiver,offset}`,
  `ParenExpression{expression}`, `TupleExpression`, `LambdaExpression`,
  `UnknownExpression{tokens}`. `CallArgument{name:string|null,value}`.
- `DrawingCallSite{call,constructor,handleType,camp,span}` and
  `PineDrawingConstructor` ("line.new"|"label.new"|"box.new"|
  "table.new"|"polyline.new"|"linefill.new").

## Issues found in the task file

1. **`AnnotatedScript` / `DiagnosticCollector` don't exist.** The real
   semantic IR is `SemanticResult`; the codebase has no diagnostic-
   collector abstraction — every stage returns a plain `readonly
   Diagnostic[]` built via `makeDiagnostic`. → Resolver signature:
   `resolveCoordinates(semantic: SemanticResult, opts: ConvertOpts):
   CoordinateResolution`, where `CoordinateResolution = { anchors:
   ReadonlyMap<ExpressionNode, ResolvedAnchor>; diagnostics: readonly
   Diagnostic[] }`. This matches `analyze`/`parseStatements`.
2. **`table.new` has no coordinate args** (it is `position`-anchored).
   The resolver iterates `drawingSites` and skips `table.new` /
   `linefill.new` (linefill takes line handles, not coords).
3. The IR field `requiresBarInterval: true` is a literal-`true` discriminant
   on the `bar-index-future` arm — kept verbatim from the task.

## Improvements over the literal task text

- Diagnostics are returned in `CoordinateResolution`, not pushed into a
  passed-in collector — keeps the resolver pure and consistent with the
  rest of the pipeline (callers concat all stage diagnostics).
- `requires-bar-interval` is emitted ONCE per resolution when a future
  anchor is produced under `barInterval == null` (deduped by a flag),
  not once per future anchor, so a script with many future anchors gets
  one actionable error. The error span is the first offending anchor's
  source expression span.

## Module layout

| File | Action | Purpose |
|------|--------|---------|
| `src/mapping/builtinIdentifiers.ts` | Create | OHLCV/`na`/`bar_index`/`xloc` identifier remap + `BUILTIN_IDENTIFIER_MAP`. |
| `src/mapping/builtinIdentifiers.test.ts` | Create | Spot checks for every mapped name. |
| `src/mapping/index.ts` | Modify | Re-export `builtinIdentifiers`. |
| `src/transform/exprEmit.ts` | Create | Pine `ExpressionNode` → chartlang-TS string. |
| `src/transform/exprEmit.test.ts` | Create | Every discriminator emits valid TS. |
| `src/transform/coordinates.ts` | Create | `resolveCoordinates` + `ResolvedAnchor`/`CoordinateResolution` types. |
| `src/transform/coordinates.test.ts` | Create | One fixture per `ResolvedAnchor.kind`. |
| `src/transform/coordinates.property.test.ts` | Create | Property: one-kind-per-callsite + emitted exprs parse via the TS API. |
| `src/transform/index.ts` | Modify | Re-export the resolver. |
| `src/diagnostics/codes.ts` | Modify | APPEND four Task-7 codes. |

## Numbered steps

1. `builtinIdentifiers.ts`: `BUILTIN_IDENTIFIER_MAP: ReadonlyMap<string,
   string>` with OHLCV → `bar.*`, `time` → `bar.time`, `bar_index` →
   `__bar_index()`, `xloc.bar_index`/`xloc.bar_time` sentinels. `na`
   default is NOT in the map (per-site override lives in `exprEmit`); a
   doc note records that. Add `barIndexBuiltin()`/`naDefault()` only if
   needed — keep it a pure data table + a `remapIdentifier(name)` helper
   returning the mapped string or `null`.
2. `exprEmit.ts`: `emitExpr(node, annotations)` recursive walker →
   string. Handles every `ExpressionNode` discriminator. Consults
   `annotations.get(node)?.naKind` for `na`/`NaExpression` (→ `null`
   when `"handle"`, else `Number.NaN`). Identifiers route through
   `remapIdentifier`. `and`/`or`/`not` → `&&`/`||`/`!`. Non-trivial
   subexpressions wrap in parens. `UnknownExpression` → emit a TS
   comment-safe fallback `undefined` (it never reaches a real coord arg;
   covered by a synthetic test).
3. `coordinates.ts`: `ResolvedAnchor` union + `CoordinateResolution`.
   `resolveCoordinates(semantic, opts)`: iterate `drawingSites`, skip
   `table.new`/`linefill.new`, extract coordinate args per constructor
   (line: (x1,y1,x2,y2) + optional `xloc`; box: (left,top,right,bottom)
   + `xloc`; label: (x,y) + `xloc`; polyline: `points` array of
   `chart.point` — resolve each element). For each (x,y) pair decide the
   kind via §2 rules. Resolve `chart.point.*` factory chains to the four
   `chart-point-*` kinds.
4. Append four diagnostic codes (`requires-bar-interval` error,
   `dynamic-bar-index` warning, `unresolved-bar-index` warning,
   `chart-point-from-index-without-xloc` warning), namespaced
   `pine-converter/transform/...`.
5. Re-export from `src/transform/index.ts` and `src/mapping/index.ts`.
6. Tests to 100% on the three source files.
7. Changeset + CLAUDE.md "Coordinate resolver" section append.

## Resolution rules (from §2, verified feasible against the AST)

- Both x,y compile-time literals (`literal-expression` numeric / a
  `unary -literal`) → `literal-world-point` with computed numbers.
- `xloc` arg resolves to `xloc.bar_time` → `bar-time-direct`.
- `xloc` is `bar_index` (default / explicit) and x is:
  - `bar_index` ident → `bar-index-historical` offset `"0"`.
  - `bar_index[N]` literal N>0 → `bar-index-historical` offset `"N"`.
  - `bar_index + N` literal N>0 → `bar-index-future` offset `"N"`,
    `requiresBarInterval:true`.
  - `bar_index - N` literal N>0 → `bar-index-historical` offset `"N"`.
  - `bar_index ± <non-literal>` → future/historical by operator sign +
    `dynamic-bar-index` warning.
  - anything else → `unresolved-bar-index` warning + historical `"0"`.
- `chart.point.now(...)` → `chart-point-now`;
  `chart.point.from_index(i, p)` → `chart-point-from-index`;
  `chart.point.from_time(t, p)` → `chart-point-from-time`;
  `chart.point.new(t, i, p)` → `chart-point-new`.

## Future-bar / barInterval contract

`bar-index-future` sets `requiresBarInterval: true`. When `opts
.barInterval == null` AND at least one future anchor is produced →
ONE `requires-bar-interval` error at the first future anchor's span.
Task 16 emits `bar.time + ((N) * __BAR_INTERVAL_MS)`; this task only
produces the `offsetExpr` string + the kind.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter lint`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100%)
- docs JSDoc on every export (`@since 0.1`, `@experimental`,
  `@example`).

## Changeset

`.changeset/pine-converter-coordinates.md` — patch bump on
`@invinite-org/chartlang-pine-converter`.

## Acceptance checklist

- [ ] `resolveCoordinates` on `line.new(bar_index, close, bar_index +
      10, close)` → one `bar-index-historical` + one `bar-index-future`
      (`requiresBarInterval:true`).
- [ ] Same script with `barInterval:null` → `requires-bar-interval`
      error in diagnostics.
- [ ] `exprEmit` of the future offset `10` → `"10"`; Task 16 wraps it.
- [ ] Every fixture's emitted exprs parse via the TS API (property).
- [ ] 100% coverage on `coordinates.ts`/`exprEmit.ts`/
      `builtinIdentifiers.ts`.
- [ ] JSDoc + lint + typecheck green; changeset committed.
