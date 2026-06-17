# Task 5 — Semantic analysis: scope + qualifiers + drawing-camp classification — Validated Plan

## Context

Walk the Task 4 Pine AST (`src/ast/`) and attach the semantic annotations
every downstream transform (Tasks 8–15) consumes: a scope graph,
qualifier inference (`const`/`input`/`simple`/`series`), `var`/`varip`
lifetime spans, declaration-vs-reassignment disambiguation, `na`-kind
inference, bar-index reference detection, and — the load-bearing output —
Camp A / Camp B / Camp C classification of every drawing `.new()`
call-site. The package-internal entry is `analyze(script: Script):
SemanticResult` in `src/semantic/analyze.ts`. Nothing is re-exported from
`src/index.ts` (same precedent as lexer/mapping/parser).

## Pre-existing work (verified against the workspace)

- **AST node shapes confirmed by reading the source** (not the task file,
  which was inaccurate once):
  - `VariableDeclaration { kind, qualifier: "var"|"varip"|"none",
    typeAnnotation: TypeAnnotation|null, name: string, initializer:
    ExpressionNode, span }` (`ast/statements.ts:63`).
  - `Assignment { kind, operator: "="|":=", name: string, value:
    ExpressionNode, span }` — **`name: string`, NOT `target:
    ExpressionNode`** (the task-file claim is false; confirmed in the
    Task 4 plan §issue-2 and `ast/statements.ts:103`).
  - `CallExpression { kind, callee: ExpressionNode, args: CallArgument[],
    span }`; `MemberAccessExpression { kind, head: ExpressionNode|null,
    chain: string[], span }`. A dotted constructor like `line.new(...)`
    parses to `Call(callee=Member(head:null, chain:["line","new"]),
    args)`. A bare global `array.push(lines, x)` is
    `Call(callee=Member(chain:["array","push"]), args)`.
    (`parser/expressions.ts:216`, verified.)
  - `IfStatement { condition, thenBody: BlockStatement, elseIfClauses:
    ElseIfClause[], elseBody: BlockStatement|null }`;
    `ForStatement { variable: string, from, to, step, body }`;
    `SwitchStatement { subject, cases: SwitchCase[] }`;
    `SwitchCase { test: ExpressionNode|null, body: Statement[] }`.
  - `HistoryAccessExpression { receiver, offset }`;
    `NaExpression { kind:"na-expression" }`; `na(...)` is a
    `CallExpression` whose callee is `Identifier("na")` — wait: `na` is a
    **keyword**, so `na(x)` does NOT parse as a call (the prefix parser
    returns a bare `NaExpression` and the `(x)` is then a postfix call on
    it). Confirmed: `parsePrimary` handles `na` before `parsePostfix`
    re-enters, so `na(x)` → `Call(callee=NaExpression, args=[x])`. The
    analyzer keys the na-kind off this `callee.kind === "na-expression"`
    shape, NOT off an identifier named "na".
- **`Script { version, declaration, body: Statement[], span }`**
  (`ast/script.ts:170`); `IndicatorDeclaration { args: Argument[] }`,
  `Argument { name: string|null, value: ExpressionNode }`. The
  `max_lines_count`/`max_labels_count`/`max_boxes_count`/`max_polylines_count`
  caps live as **named** `Argument`s on the indicator declaration.
- **Mapping surface** (`src/mapping/`): `DRAWING_KIND_MAP` keys are the six
  `PineDrawingConstructor` strings (`line.new`, `label.new`, `box.new`,
  `table.new`, `polyline.new`, `linefill.new`); `drawingLookup(key)`
  returns the `DrawingMapping` or `null` (`linefill.new` is a REJECT →
  `null`). The analyzer consults `DRAWING_KIND_MAP.has(key)` to recognise a
  drawing constructor (it must recognise `linefill.new` even though its
  chartlang target is null — `linefill.new` is Camp-C territory), and uses
  the constructor key's object-namespace prefix (`line`/`label`/…) for the
  handle type.
- **Diagnostic registry** (`src/diagnostics/codes.ts`): single typed
  `DIAGNOSTIC_CODES` record + `makeDiagnostic(key, span, messageOverride?)`.
  Codes are namespaced; parser codes are `pine-converter/parse/...`. Task 5
  codes will be `pine-converter/semantic/...`. `DiagnosticSeverity` is
  `"error"|"warning"|"info"` (confirmed `src/index.ts:28`) — every Task-5
  severity is representable.
- **`SourceSpan`/`Diagnostic`** are the package types in `src/index.ts`.
- **`vitest.config.ts`** excludes `src/**/index.ts` + `src/**/types.ts`
  from coverage. New `src/semantic/types.ts` (pure declarations) is auto-
  excluded by the `**/types.ts` glob; `src/semantic/index.ts` (barrel) is
  excluded. All real logic modules must hold 100%.

## Issues found / resolved

1. **Task-file claim `Assignment.target: ExpressionNode` is FALSE** — it is
   `name: string`. Resolution: the analyzer reads `Assignment.name` for the
   reassignment target; no parser change.
2. **Tuple-LHS multi-return (`[a, b] = f()`) — DECISION.** The parser does
   NOT parse a leading `[` statement: it falls through to `parseExpression`,
   which cannot start on `[`, yielding `unknown-expression` →
   `unexpected-token` + line recovery (`parser/statements.ts:394`). So
   `[a,b] = f()` is already discarded before semantic analysis ever sees it.
   The v1 drawing scope (README) **defers** the multi-return surfaces
   (`request.security`/MTF) entirely, and drawing constructors return a
   single handle. Wiring a new tuple-LHS statement form would require parser
   changes the task tells me to avoid. **Resolution: do NOT wire tuple-LHS
   in the parser.** Instead the analyzer guards any `TupleExpression`
   reaching a *value* position (declaration initializer / assignment value /
   call arg) with a new `unsupported-tuple-destructuring` (info) diagnostic,
   giving downstream transforms one clean signal. Documented in CLAUDE.md
   append + reported to team-lead.
3. **`na(x)` is not an identifier call.** `na` is a keyword → `NaExpression`
   node; `na(x)` is `Call(callee=NaExpression)`. The na-kind inference keys
   off `callee.kind === "na-expression"`, not a string match.
4. **Drawing-constructor recognition must include `linefill.new`** even
   though `drawingLookup("linefill.new") === null` (REJECT). The recogniser
   uses `DRAWING_KIND_MAP.has(key)` (membership), not `drawingLookup`
   (usable-target), so `linefill.new` is still classified (→ Camp C).
5. **No naming conflicts.** `src/semantic/` currently holds only a
   placeholder `index.ts`. `Scope`/`SymbolInfo`/`DrawingCamp`/
   `SemanticResult`/`LifetimeInfo` names are unused elsewhere in the
   package (grep-verified).
6. **Builtins breadth vs coverage.** Every built-in row must be reachable;
   `builtins.test.ts` exercises representative rows per qualifier class so
   the table is data-only (no branches) and trivially 100%.

## Output type design (load-bearing — 8 transforms depend on it)

The transform tasks (10/11/12/13/14) call
`transformX(site: DrawingCallSite, analysis: SemanticResult, …)` and read
`DrawingCamp.kind`. So the analyzer publishes BOTH a per-call map and a
flat site list:

```ts
// src/semantic/types.ts (pure declarations, coverage-excluded)
SemanticResult = Readonly<{
    script: Script;
    rootScope: Scope;
    scopes: ReadonlyMap<AstNode, Scope>;             // node → enclosing scope
    annotations: ReadonlyMap<AstNode, SemanticAnnotation>;
    symbols: ReadonlyMap<SourceSpan, SymbolInfo>;     // decl-span → symbol
    lifetimes: LifetimeMap;                           // SymbolInfo → LifetimeInfo
    drawingSites: readonly DrawingCallSite[];          // ordered, source order
    drawingClassifications: ReadonlyMap<CallExpression, DrawingCamp>;
    referencesBarIndex: boolean;
    referencesFutureBarIndex: boolean;
    diagnostics: readonly Diagnostic[];
}>;

DrawingCallSite = Readonly<{
    call: CallExpression;            // the `.new()` call
    constructor: PineDrawingConstructor;  // "line.new" | …
    handleType: HandleType;          // "line" | "label" | …
    camp: DrawingCamp;
    span: SourceSpan;
}>;

DrawingCamp =
  | { kind:"camp-a"; handleSymbol: SymbolInfo }
  | { kind:"camp-b"; collectionSymbol: SymbolInfo; cap: number; capSource: "max-count-decl"|"bucket-default" }
  | { kind:"camp-c-bounded"; reasoning: string }
  | { kind:"camp-c-unbounded"; reasoning: string };
```

`AstNode` = the union of every node type (Script | Declaration | Statement
| ExpressionNode | CallArgument | …) used as a `WeakMap`/`Map` key. Because
the spec wants `ReadonlyMap<AstNode, …>` and AST nodes are object
references, a `Map` keyed by node identity is used (a `WeakMap` cannot be
iterated, and the spec exposes the maps as iterable `ReadonlyMap`s).
`SemanticAnnotation` carries `{ qualifier?: TypeQualifier; naKind?:
"numeric"|"handle"; assignment?: AssignmentAnnotation }`.

The `symbols` map is keyed by `SourceSpan` (the declaration span) rather
than by `SymbolInfo` reference so `LifetimeMap`'s `SymbolInfo` keys stay
stable across lookups (a single `SymbolInfo` object per declaration is the
shared identity).

## Numbered steps (verified paths)

1. `src/semantic/types.ts` — CREATE: pure `export type` for `SymbolKind`,
   `SymbolInfo`, `Scope`, `TypeQualifier`, `HandleType`, `SemanticAnnotation`,
   `AssignmentAnnotation`, `LifetimeInfo`, `LifetimeMap`, `DrawingCamp`,
   `DrawingCallSite`, `SemanticResult`, `AstNode`. JSDoc on every export.
   Coverage-excluded (`**/types.ts`).
2. `src/diagnostics/codes.ts` — MODIFY: add Task-5 codes under
   `pine-converter/semantic/...`: `accidental-shadowing` (warning),
   `history-on-non-series` (warning), `unknown-identifier` (error),
   `dynamic-handle-collection` (info), `unbounded-handle-collection`
   (error), `unsupported-tuple-destructuring` (info).
3. `src/semantic/builtins.ts` — CREATE: `BUILTIN_SYMBOLS:
   ReadonlyMap<string, SymbolInfo>` seeded per §2 of the task. Helper
   `builtin(name, qualifier, handleType?)` builds rows; namespace
   identifiers (`line`, `ta`, `math`, `input`, …) seed as `qualifier:
   "simple"` namespace handles. Exhaustive enough for v1, data-only.
4. `src/semantic/scope.ts` — CREATE: `Scope` builder utilities —
   `createScope(parent, span)`, `defineSymbol(scope, info)`,
   `resolve(scope, name): SymbolInfo | null` (walks parent chain, falls
   back to `BUILTIN_SYMBOLS`). Scopes are immutable snapshots built by the
   walker; the builder uses a mutable internal `Map` then freezes.
5. `src/semantic/qualifiers.ts` — CREATE: `inferQualifier(expr, resolve):
   TypeQualifier` implementing the lattice join (`const < input < simple <
   series`) per §3, plus `joinQualifier(a, b)` and the `na`-kind helper
   `inferNaKind(call|na, resolve)`.
6. `src/semantic/lifetimes.ts` — CREATE: `collectLifetimes(script, scopes,
   resolve): LifetimeMap` gathering, per `var`/`varip` symbol, its
   reassignment / mutator-call / delete-call sites (§4).
7. `src/semantic/drawingCamp.ts` — CREATE: `classifyDrawingSites(script,
   resolve, lifetimes, indicatorCaps): { sites; classifications;
   diagnostics }` applying the ordered Camp A→B→C rules (§5). Cap
   extraction reads ring-buffer eviction (`array.size(c) > K →
   *.delete(array.shift(c))`) and the indicator `max_*_count` named args.
8. `src/semantic/analyze.ts` — CREATE: `analyze(script): SemanticResult`
   orchestrating the walk: build scopes, annotate qualifiers + na-kind +
   assignment kind, detect bar-index refs, run lifetimes + camp
   classification, collect tuple-destructuring + unknown-identifier +
   history-on-non-series + shadowing diagnostics. Package-internal.
9. `src/semantic/index.ts` — REPLACE placeholder: barrel re-export of
   `analyze` + all `types.ts` symbols.
10. Tests: `analyze.test.ts`, `analyze.property.test.ts`,
    `drawingCamp.test.ts`, `builtins.test.ts`. 100% on `src/semantic/`.
11. `.changeset/pine-converter-semantic.md` — patch.
12. Append "Semantic analysis" section to
    `packages/pine-converter/CLAUDE.md` (camp contract + tuple decision).

## Files to create / modify

| File | Action |
|------|--------|
| `src/semantic/types.ts` | create (pure types) |
| `src/semantic/builtins.ts` | create |
| `src/semantic/scope.ts` | create |
| `src/semantic/qualifiers.ts` | create |
| `src/semantic/lifetimes.ts` | create |
| `src/semantic/drawingCamp.ts` | create |
| `src/semantic/analyze.ts` | create |
| `src/semantic/index.ts` | replace placeholder |
| `src/diagnostics/codes.ts` | modify (6 codes) |
| `src/semantic/analyze.test.ts` | create |
| `src/semantic/analyze.property.test.ts` | create |
| `src/semantic/drawingCamp.test.ts` | create |
| `src/semantic/builtins.test.ts` | create |
| `.changeset/pine-converter-semantic.md` | create |
| `packages/pine-converter/CLAUDE.md` | append section |

Do NOT touch `src/lexer/`, `src/mapping/src` data, `src/parser/`,
`src/index.ts`, `vitest.config.ts`.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% cov)
- `pnpm lint` (Biome) on touched files
- `pnpm docs:check` (every `@example` typechecks)

## Changeset

`.changeset/pine-converter-semantic.md` — `patch` on
`@invinite-org/chartlang-pine-converter`.

## Acceptance checklist

- [ ] `analyze(parseStatements(lex(camp-a-fixture)).script)` yields one
      `camp-a` whose `handleSymbol.name` matches the declared `var`.
- [ ] Camp B fixture with `array.shift(lines)` eviction at `array.size(lines)
      > 10` → `cap===10`, `capSource==="max-count-decl"`.
- [ ] Camp C-unbounded fixture (`linefill.new(arr.get(i), arr.get(j))`)
      emits `unbounded-handle-collection` at the call-site span.
- [ ] `close.qualifier==="series"`, `xloc.bar_index.qualifier==="const"`,
      `barstate.islast` resolves to the root scope.
- [ ] tuple-LHS value position emits `unsupported-tuple-destructuring`.
- [ ] 100% coverage on `src/semantic/`; lint + typecheck + docs:check green.
- [ ] changeset + CLAUDE.md append landed.
