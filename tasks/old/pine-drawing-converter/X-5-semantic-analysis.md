# Task 5 — Semantic analysis: scope + qualifier inference + drawing-camp classification

> **Status: TODO**

## Goal

Walk the Pine AST produced by Task 4 and attach the semantic
annotations every downstream transform needs: a scope graph, type-
qualifier inference (`const`/`input`/`simple`/`series`), `var`/`varip`
lifetime spans, declaration-vs-reassignment disambiguation, and — most
importantly for the v1 — classification of every `line.new`/
`label.new`/`box.new`/`polyline.new` call-site into Camp A / Camp B /
Camp C drawing-handle modes. This task produces the **annotated AST**
all transform tasks (Tasks 8–15) consume.

## Prerequisites

Task 4 (full expression parser + UDT reject).

## Current Behavior

`src/semantic/index.ts` is a placeholder. The parser produces a bare
AST with no scope information.

## Desired Behavior

A package-internal `analyze(script: Script): SemanticResult` API in
`src/semantic/analyze.ts` that returns:

- `annotated: AnnotatedScript` — the same AST decorated with
  `SemanticAnnotation` per node (attached via a `WeakMap<AstNode,
  SemanticAnnotation>` to keep AST nodes immutable).
- `scopes: ReadonlyMap<AstNode, Scope>` — scope graph.
- `drawingClassifications: ReadonlyMap<CallExpression, DrawingCamp>` —
  per-call-site Camp A/B/C decision.
- `diagnostics: readonly Diagnostic[]`.

## Requirements

### 1. Scope model (`src/semantic/scope.ts`)

```ts
export type SymbolKind =
    | "variable"           // `x = expr`
    | "var-variable"       // `var x = expr`
    | "varip-variable"     // `varip x = expr`
    | "for-iterator"
    | "function-parameter"
    | "builtin";

export type SymbolInfo = Readonly<{
    name: string;
    kind: SymbolKind;
    declarationSpan: SourceSpan | null;   // null for builtins
    typeAnnotation: TypeAnnotation | null;
    qualifier: TypeQualifier;             // const | input | simple | series
    handleType: "line" | "label" | "box" | "table" | "polyline" | "linefill" | null;
}>;

export type Scope = Readonly<{
    parent: Scope | null;
    symbols: ReadonlyMap<string, SymbolInfo>;
    span: SourceSpan;
}>;
```

Scopes form a tree rooted at the script. Each `IfStatement` branch,
`ForStatement`, and `SwitchCase` body opens a child scope. Pine has no
block scoping outside these constructs.

### 2. Built-in seeding (`src/semantic/builtins.ts`)

Seed the root scope with every Pine v6 built-in name needed for v1
semantic analysis: `open`, `high`, `low`, `close`, `volume`, `hl2`,
`hlc3`, `ohlc4`, `time`, `bar_index`, `na`, `barstate.*` members,
`xloc.*`, `yloc.*`, `extend.*`, `line.style_*`, `label.style_*`,
`size.*`, `text.align_*`, `text.format_*`, `font.family_*`,
`position.*`, `color.*` constants, `line`, `label`, `box`, `table`,
`polyline`, `linefill` (object-namespace identifiers), `ta`, `math`,
`input`, `request`, `chart.point`, plot family (`plot`, `plotshape`,
`plotchar`, `plotcandle`, `plotbar`, `plotarrow`, `hline`, `fill`,
`bgcolor`, `barcolor`).

Built-ins always have `qualifier: "series"` for series-typed names
(`close`, `volume`, …), `qualifier: "const"` for enum constants,
`qualifier: "input"` for things settable in the dialog. The full list
is data-driven and lives in `src/semantic/builtins.ts` as a
`ReadonlyMap<string, SymbolInfo>`.

### 3. Qualifier inference

Pine's qualifier lattice: `const < input < simple < series`. Each
expression node gets an inferred qualifier based on its operands:

- Literal → `const`.
- `input.*` call → `input`.
- `var x = expr` → `x`'s qualifier matches `expr`'s qualifier; but
  inside `if barstate.islast` blocks, the runtime treats `var`-declared
  drawing handles as effectively `series` (live across bars).
- Built-in series (`close`, etc.) → `series`.
- Binary expression with two operands → max of operand qualifiers
  (lattice join).
- `ta.*` calls → `series` (Pine always returns series from `ta.*`).
- History access `x[n]` → matches `x`'s qualifier (history can only be
  taken on series; if `x` is non-series, emit `history-on-non-series`
  warning).

Store the inferred qualifier on the `SemanticAnnotation` for every
expression node.

### 4. `var` / `varip` lifetime analysis (`src/semantic/lifetimes.ts`)

For each `var`/`varip` declaration:

- Compute the set of reassignment sites (`x := ...` or `x = ...` where
  scope resolution finds the same `var` symbol).
- Compute the set of mutator-call sites (`line.set_xy1(x, ...)`,
  `label.set_text(x, ...)`, etc.) where `x` is a handle-typed
  variable.
- Compute the set of `*.delete(x)` calls.
- Record the lifetime: (declaration span, reassignments, mutations,
  deletions).

Output: `LifetimeMap = ReadonlyMap<SymbolInfo, LifetimeInfo>`.

This is the data Task 10 (Camp A) consumes to determine where the
single `draw.<kind>(...)` callsite goes in the output and how to fold
mutations.

### 5. Drawing-camp classification (`src/semantic/drawingCamp.ts`)

For every `line.new`/`label.new`/`box.new`/`polyline.new` /
`linefill.new` call-site, classify into:

```ts
export type DrawingCamp =
    | { kind: "camp-a"; handleSymbol: SymbolInfo }
    | { kind: "camp-b"; collectionSymbol: SymbolInfo; cap: number; capSource: "max-count-decl" | "bucket-default" }
    | { kind: "camp-c-bounded"; reasoning: string }   // attemptable heuristic
    | { kind: "camp-c-unbounded"; reasoning: string }; // hard-reject
```

Decision rules (apply in order):

1. **Camp A** — the result of the call is assigned to a `var` or
   `varip` symbol, AND the symbol is the sole holder (not pushed into
   an array, not stored in a record), AND any mutators in the script
   target that same symbol.
2. **Camp B-bounded** — the result is `array.push(<collection>, …)`'d
   to a `var array<line/label/box>` whose lifecycle pattern matches the
   ring-buffer idiom: a `push` followed (within the same `if` block or
   anywhere in the script) by a guarded `if array.size(<collection>)
   > K → line.delete(array.shift(<collection>))`. Extract `K`. If
   `K` is a literal int or an `input.int` (whose default is read), set
   `capSource: "max-count-decl"`; if no explicit cap is detected but
   the `indicator(...)` declaration sets `max_lines_count` /
   `max_labels_count` / `max_boxes_count`, use that.
3. **Camp C-bounded** — the result is `array.push`'d to a `var
   array<…>` but no ring-buffer eviction is detected; however, an
   `indicator(...)` cap is set. Heuristic: use the cap as `K` and warn
   that the script must rely on Pine's implicit FIFO GC.
4. **Camp C-unbounded** — anything else (no cap detectable, addressed
   by data-dependent loops, used in `linefill.new(a, b)` with `a`/`b`
   from a collection, polyline rebuilt from a dynamic `array<chart.point>`).

Every classification carries the source span of the `.new()` call-site
for downstream diagnostic context. The `reasoning` field is a short
human-readable string used in warning diagnostics.

### 6. Declaration-vs-reassignment disambiguation

A statement parsed as `Identifier "=" Expression` by Task 3 is either:

- A **declaration** — `Identifier` doesn't yet exist in the current or
  any enclosing scope.
- A **reassignment** — `Identifier` exists in some enclosing scope
  AND the operator is `=` (Pine syntax requires `:=` for
  reassignment, but the wild idiom uses `=`; Pine v6 treats this as
  shadowing a variable, which is usually a bug). Emit
  `accidental-shadowing` warning. The semantic annotation marks the
  assignment as `kind: "declaration"` with shadowing flag.

Re-export the annotation as `AssignmentAnnotation { kind:
"declaration" | "reassignment"; shadows: SymbolInfo | null }`.

### 7. `na` semantics by symbol kind

Pine's `na` is overloaded: it's both a sentinel value (for numeric
series) and a "no handle" marker (for drawing-handle types). The
semantic pass annotates every `IdentifierExpression` referencing `na`
and every `CallExpression` of `na(...)` with the inferred operand
type so the transform layer (Tasks 7, 10) can lower correctly:

- `na` in numeric context → chartlang `Number.NaN` (Task 7's
  `BUILTIN_IDENTIFIER_MAP`).
- `na` assigned into a `var line/label/box/table/polyline/linefill`
  handle → chartlang `null` (the `useDrawingHandleSlot` closure
  initial value).
- `na(handle_var)` call → chartlang `handle.current() === null` check
  (or `handleVar === null` for direct closure storage).
- `na(series_expr)` call → chartlang `Number.isNaN(value)` check.

Record the inferred kind on the `SemanticAnnotation` (`naKind:
"numeric" | "handle"`); transforms read this rather than re-running
the kind inference.

### 8. Bar-index reference detection

Walk the AST. For every `IdentifierExpression` referencing
`bar_index`, and every `HistoryAccessExpression` whose receiver is
`bar_index`, set a flag `semanticResult.referencesBarIndex = true`.
For `bar_index + N` arithmetic where `N > 0` (forward projection),
set `referencesFutureBarIndex = true`. Task 7's coordinate resolver
keys on these.

### 9. Diagnostic codes (added this task)

- `accidental-shadowing` (warning)
- `history-on-non-series` (warning)
- `unknown-identifier` (error)
- `dynamic-handle-collection` (info) — Camp B-bounded with no
  explicit eviction
- `unbounded-handle-collection` (error) — Camp C-unbounded

### 10. Tests (§16.3)

| File | Purpose |
|------|---------|
| `analyze.test.ts` | Per-rule fixtures: scope tree depth, qualifier propagation, var lifetime, handle-mutation tracking. |
| `analyze.property.test.ts` | Property: every `IdentifierExpression` resolves to a `SymbolInfo` (or emits `unknown-identifier`). Property: lifetime spans never extend before the declaration. |
| `drawingCamp.test.ts` | One fixture per camp + every subcamp. Includes the canonical "var line + barstate.islast mutate" (Camp A), "push to var array + delete shift on overflow" (Camp B-bounded), "push to var array, no eviction" (Camp B-unbounded → Camp C-bounded), "linefill.new(arr.get(i), arr.get(j))" (Camp C-unbounded). |
| `builtins.test.ts` | Spot checks: `close.qualifier === "series"`, `xloc.bar_index.qualifier === "const"`, `barstate.islast` reaches the root scope. |

Coverage 100% on `src/semantic/`.

### 11. JSDoc

Every export carries `@since 0.1`, `@experimental`, and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/semantic/analyze.ts` | Create | Entry point. |
| `packages/pine-converter/src/semantic/scope.ts` | Create | Scope graph types + builder. |
| `packages/pine-converter/src/semantic/qualifiers.ts` | Create | Qualifier inference. |
| `packages/pine-converter/src/semantic/lifetimes.ts` | Create | `var`/`varip` lifetime tracking. |
| `packages/pine-converter/src/semantic/drawingCamp.ts` | Create | Camp A/B/C classification. |
| `packages/pine-converter/src/semantic/builtins.ts` | Create | Pine v6 built-in symbol table. |
| `packages/pine-converter/src/semantic/index.ts` | Replace placeholder | Barrel re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-5 codes. |
| `packages/pine-converter/src/semantic/analyze.test.ts` | Create | Scope/qualifier/lifetime unit tests. |
| `packages/pine-converter/src/semantic/analyze.property.test.ts` | Create | Identifier-resolution + lifetime properties. |
| `packages/pine-converter/src/semantic/drawingCamp.test.ts` | Create | Camp classification per-camp fixtures. |
| `packages/pine-converter/src/semantic/builtins.test.ts` | Create | Built-in seeding sanity. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-semantic.md` — patch bump.

## Acceptance Criteria

- `analyze(parseStatements(lex(camp-a-fixture)).script)` produces one
  Camp A classification for the `line.new(...)` call-site, whose
  `handleSymbol.name` matches the declared `var` identifier.
- Camp B-bounded fixture (with `array.shift(lines)` eviction at
  `array.size(lines) > 10`) classifies with `cap === 10`,
  `capSource === "max-count-decl"`.
- Camp C-unbounded fixture (`linefill.new(arr.get(i), arr.get(j))`)
  emits `unbounded-handle-collection` diagnostic with the call-site
  span.
- 100% coverage on `src/semantic/`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
