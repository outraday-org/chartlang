# Task 8 — Plan: Transform declarations → scaffold IR + DiagnosticCollector

## Context

Foundation of the transform layer. Tasks 9–15 consume the `ScriptScaffold`
IR, the scaffold mutators, and the `DiagnosticCollector` this task creates.
Verified against the actual workspace (task files have mis-stated shapes):

- Semantic IR entry: `analyze(script): SemanticResult` —
  `src/semantic/types.ts`. `SemanticResult.script.declaration` is a
  `Declaration | null` (`IndicatorDeclaration` / `StrategyDeclaration` /
  `LibraryDeclaration` / `ImportDeclaration`, `src/ast/script.ts`); each
  `*Declaration` carries `args: readonly Argument[]` where `Argument =
  { name: string | null; value: ExpressionNode; span }`.
- chartlang constructors: `defineIndicator(opts: DefineIndicatorOpts)` /
  `defineDrawing(opts: DefineDrawingOpts)` (`packages/core/src/define/`).
  Verified option fields: `name`, `apiVersion: 1`, `overlay?` (indicator
  only), `format?: ValueFormat`, `precision?`, `scale?: ScaleAxis`
  (indicator only — `DrawingOverrides` omits `scale`/`maxBarsBack`),
  `maxBarsBack?` (indicator only), `shortName?`, `maxDrawings?:
  DrawingCounts` (`{ lines; labels; boxes; polylines; other }`).
- `ConvertOpts`/`ConvertResult`/`Diagnostic`/`SourceSpan`/
  `DiagnosticSeverity` live in `src/index.ts` — reused, not redefined.
- Diagnostic registry `src/diagnostics/codes.ts` with `makeDiagnostic(key,
  span, message?)`; `codes.test.ts` asserts a namespace regex already
  including `transform`. New Task-8 codes are `pine-converter/transform/...`
  so the regex needs no change.

## Pre-existing

- `resolveCoordinates` / `emitExpr` re-exported from
  `src/transform/index.ts`. Every prior pass RETURNS diagnostics in its
  result; there is NO mutable collector yet.

## Issues / decisions

1. **DiagnosticCollector does not exist.** Tasks 8/10–15 reference
   `diagnostics: DiagnosticCollector` and Tasks 10–15 are `void`-returning
   mutators. Decision: create `src/transform/diagnosticCollector.ts` —
   a small mutable accumulator: `push(diagnostic)`, `pushCode(key, span,
   message?)` (wraps `makeDiagnostic`), `has(code)`, `toArray()`, `size`.
   Exported from `src/transform/index.ts`. This is the single mutation
   surface for diagnostics across Tasks 8–15.
2. **`ir.ts` is declaration-only.** `ScriptScaffold`/`ComputeBodyIR`/
   `StateSlotIR`/`HandleSlotIR`/`HandleRingIR`/`InputDeclarationIR` are pure
   `export type` (mutable arrays the mutators append to). No runtime →
   exclude from coverage in `vitest.config.ts` (precedent: `ast/*.ts`).
   All real logic (mutators, declaration transform, arg map) lives in
   coverage-covered modules.
3. **Mutable arrays on a `Readonly<>` scaffold.** The scaffold's collection
   fields are plain mutable arrays (`InputDeclarationIR[]`) so the mutators
   can `push`; the top-level record is `Readonly` (fields not reassigned).
   `ComputeBodyIR` holds a mutable `statements` array.
4. **Format/scale narrowing.** IR `format` is `"price"|"percent"|"volume"|
   null` and `scale` is `"left"|"right"|null` (the subset Pine maps to);
   core's `ValueFormat`/`ScaleAxis` are wider but accept these.
   `format.inherit` / `scale.none` → null + warning.
5. **maxDrawings defaults.** Per §2, omitted `max_*_count` → 50 per bucket
   to preserve Pine GC behaviour. `max-count-out-of-range` warning when a
   Pine value exceeds the chartlang bucket cap (lines/labels/boxes 500,
   polylines 100) — clamp to the cap.
6. **Constructor choice.** Walk `script.body` recursively for plot-family
   calls (`plot`/`plotshape`/…/`hline`/`fill`/`bgcolor`/`barcolor`) vs
   `result.drawingSites.length > 0`. Plot present → `defineIndicator`; no
   plot + drawings → `defineDrawing` + `drawing-only-script` info; neither →
   `defineIndicator`.
7. **strategy → indicator** synth shell (§4): map `title`→`name`, keep
   `max_*_count`, drop strategy-only args, emit `strategy-as-indicator`.
   `library` is hard-rejected upstream (Task 3) — this task does not
   synthesize one; `transformDeclaration` is only called for indicator /
   strategy declarations (codegen returns `output: null` for library).
8. **Computed title** (§5): non-string-literal `title` → error
   `computed-indicator-title`, fallback name `"<unknown>"`.

## Steps

1. `src/transform/ir.ts` (create) — the six IR types.
2. `src/transform/diagnosticCollector.ts` (create) — `DiagnosticCollector`.
3. `src/diagnostics/codes.ts` (modify) — append five Task-8 codes.
4. `src/transform/scaffoldMutators.ts` (create) — `appendInput` /
   `appendStateSlot` / `appendComputeStatement` / `appendHandleSlot` /
   `appendHandleRing`.
5. `src/transform/declarationArgs.ts` (create) — `mapIndicatorArgs(args,
   diagnostics): ScaffoldOptions` (the §2 table).
6. `src/transform/declaration.ts` (create) — `transformDeclaration(decl,
   analysis, diagnostics): ScriptScaffold`.
7. `src/transform/index.ts` (modify) — re-export all of the above.
8. `vitest.config.ts` (modify) — exclude `src/transform/ir.ts`.
9. Tests: `declaration.test.ts`, `declaration.property.test.ts`,
   `constructor-choice.test.ts`, `strategy-downgrade.test.ts`,
   `diagnosticCollector.test.ts`, `scaffoldMutators.test.ts`,
   `declarationArgs.test.ts`, `codes.test.ts` (extend).

## Files

| File | Action |
|------|--------|
| `src/transform/ir.ts` | create |
| `src/transform/diagnosticCollector.ts` | create |
| `src/transform/scaffoldMutators.ts` | create |
| `src/transform/declarationArgs.ts` | create |
| `src/transform/declaration.ts` | create |
| `src/transform/index.ts` | modify (re-export) |
| `src/diagnostics/codes.ts` | modify (append 5 codes) |
| `vitest.config.ts` | modify (exclude ir.ts) |
| `src/transform/*.test.ts` (7 new) + `codes.test.ts` | create/modify |

## Gates

`pnpm --filter @invinite-org/chartlang-pine-converter` typecheck / test
(100% coverage) / lint / docs:check.

## Changeset

`.changeset/pine-converter-transform-declaration.md` — patch bump.

## Acceptance

- `indicator("Hello", overlay=true, max_lines_count=20)` →
  `name="Hello"`, `overlay=true`, `maxDrawings.lines=20`.
- draw-only script → `constructor==="defineDrawing"` + `drawing-only-script`.
- `strategy("S")` → `defineIndicator`, `name==="S"`, `strategy-as-indicator`.
- computed title → `computed-indicator-title` error.
- 100% coverage; JSDoc + lint + typecheck + docs:check green; changeset.
