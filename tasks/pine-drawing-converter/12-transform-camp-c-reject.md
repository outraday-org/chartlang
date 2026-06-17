# Task 12 — Transform: Camp C heuristics + hard-reject diagnostics

> **Status: TODO**

## Goal

For drawing call-sites the semantic analyzer classified as Camp C —
dynamic collections of drawings whose count or addressing pattern
doesn't fit Camp B's ring-buffer model — apply a small set of best-
effort heuristics where they can preserve script intent, otherwise
emit a precise hard-reject diagnostic with a concrete suggested rewrite.
This task is the converter's safety net: no Camp C site silently
produces wrong output.

## Prerequisites

Task 11 (Camp B established, so the boundary "what's not Camp B" is
sharp).

## Current Behavior

Camp C sites are classified by Task 5 with `kind:
"camp-c-bounded"` (attemptable heuristic) or `kind:
"camp-c-unbounded"` (hard-reject). No transform exists for either.

## Desired Behavior

A package-internal `transformCampC(site: DrawingCallSite, analysis:
SemanticResult, scaffold: ScriptScaffold, diagnostics:
DiagnosticCollector): void` API in `src/transform/campC.ts` either:

- Applies a registered heuristic to fold the site into a Camp B
  transformation (and emits a `camp-c-heuristic-applied` info), or
- Emits a structured hard-reject diagnostic naming the obstacle, the
  source span, and one concrete suggested rewrite the user can paste
  back into Pine to make the script convertible.

## Requirements

### 1. Heuristics (`src/transform/campCHeuristics.ts`)

Three heuristics for v1; each is a pure function over the
classification + AST context.

**Heuristic H1 — implicit-cap-from-indicator.** When the script has
`indicator(..., max_lines_count=N)` set but the eviction logic is
absent (push without size-gate + shift), promote to Camp B with K=N.
Pine's runtime would FIFO-evict at N anyway, so this preserves
behavior. Emit `camp-c-heuristic-applied` with reasoning "implicit
FIFO at N=⟨N⟩ from indicator() declaration".

**Heuristic H2 — bounded-by-loop-bound.** When the only `array.push`
site lives inside a `for i = 0 to L - 1` loop where `L` is a literal
or `input.int`, promote to Camp B with K = `L` (or the
`input.int.default` for inputs). Emit `camp-c-heuristic-applied` with
reasoning "loop-bound K = ⟨L⟩".

**Heuristic H3 — single-use-collection.** When the collection is
created, pushed N times in a straight-line block, immediately consumed
(read via `for ... in arr` once), then `array.clear()`'d or goes out
of scope, promote to Camp B with K = the literal N. Emit
`camp-c-heuristic-applied` with reasoning "single-use straight-line
push of N=⟨N⟩". The `for...in` is rejected as before but here gets a
specialized message pointing at the heuristic that almost rescued it.

If no heuristic applies → hard-reject (see §2).

### 2. Hard-reject taxonomy

Each reject emits one of the following structured codes with a
hand-written `suggestion` string:

| Code | When | Suggestion template |
|---|---|---|
| `unbounded-handle-collection` | Push site has no detectable cap and no heuristic applies | "Add `max_lines_count=N` (or labels/boxes/polylines) to your indicator() declaration, **and** a size-gate eviction (`if array.size(x) > N → line.delete(array.shift(x))`)." |
| `dynamic-handle-index` | `array.get(arr, dynamic_expr)` where `dynamic_expr` isn't a literal-bounded loop index | "Replace dynamic indexing with a `for i = 0 to ⟨K⟩ - 1` loop where K is a literal." |
| `cross-collection-linefill` | `linefill.new(array.get(linesA, i), array.get(linesB, j))` | "linefill across two collections has no chartlang analogue. Consider a single `draw.path(...)` over the pair of anchor points instead." |
| `polyline-dynamic-points` | `polyline.new(array_with_dynamic_size, …)` | "chartlang `draw.polyline` requires a literal-bounded anchor array. Build the anchor list in a `for (let i = 0; i < ⟨K⟩; i++)` loop." |
| `handle-copy` | `*.copy(handle)` on any handle | "Drawing copy has no chartlang analogue (handles aren't first-class values). Re-create the drawing at the new location instead." |
| `handle-store-in-udt` | Handle stored in a user-defined type / record | "UDTs aren't supported in v1. Hoist the handle into a `var line/label/box` declaration at the script top level." |
| `for-in-line-all` | `for ln in line.all` (or `box.all`/`label.all`) | "Bulk-iterate over all drawings isn't supported. Track handles explicitly in a `var array<line>` (Camp B)." |

Every reject carries the source span and continues processing — the
converter does **not** halt on the first reject. The output script
will compile (because the reject sites are skipped) but will be
semantically incomplete; the diagnostic array surfaces every reject
for the user to review.

### 3. Reject visibility in output

For each hard-reject, emit a comment in the generated chartlang TS at
the corresponding position:

```ts
// [pine-converter] HARD-REJECT (unbounded-handle-collection) at <file>:<line>:<col>
// Pine: line.new(...)
// See diagnostics for suggested rewrite.
```

The Pine source line is captured by reading the offending span's text
and embedding it as a single-line comment (multi-line Pine source is
joined into one line with `\n` literal). This anchors the reject in
the output so a reader sees both what didn't convert and where.

### 4. `strict mode` interaction

When `ConvertOpts.strictMode === true`, every reject is upgraded to
an error that prevents `ConvertResult.output` from being emitted —
the result becomes `{ output: null, manifest: null, diagnostics }`.
This is the "fail-loud" mode for CI use.

In default mode (strictMode = false), rejects still emit at error
severity but `output` is still generated (with the reject comments).

### 5. Diagnostic-suggestion templating

Each suggestion is a function over the classification context, not a
static string:

```ts
type SuggestionFn = (ctx: CampCContext) => string;
type RejectEntry = Readonly<{
    code: string;
    severity: "error";
    template: SuggestionFn;
}>;

const REJECT_TABLE: ReadonlyMap<string, RejectEntry>;
```

The suggestion template receives the inferred K (if any), the
collection identifier, and the offending call-site so messages can be
specific ("…with K=20 to your indicator() declaration"). Templates
live in `src/transform/campCRejects.ts`.

### 6. Heuristic decision logging

Every heuristic application emits an info diagnostic so the
conversion is auditable:

```
[info] camp-c-heuristic-applied at fixtures/foo.pine:42:5
       heuristic: implicit-cap-from-indicator
       reasoning: implicit FIFO at N=50 from indicator() declaration
```

This is critical for trust — users can see exactly when the converter
made an assumption that might differ from Pine's runtime behavior.

### 7. Tests (§16.3)

| File | Purpose |
|------|---------|
| `campC-heuristics.test.ts` | One fixture per heuristic: H1 (indicator cap), H2 (loop-bound), H3 (single-use). Assert promotion to Camp B + info diagnostic. |
| `campC-rejects.test.ts` | One fixture per reject code: unbounded, dynamic-index, cross-collection-linefill, polyline-dynamic, handle-copy, handle-store-in-udt, for-in-line-all. Assert the right code + suggested-rewrite substring + reject comment in output. |
| `strict-mode.test.ts` | Same fixture in strict vs default mode — strict produces `output: null`, default produces output with reject comments. |
| `campC-property.test.ts` | Property: every Camp C site either applies a heuristic (info diagnostic + Camp B output) or emits exactly one hard-reject. No silent dropping. |

Coverage 100% on `src/transform/campC.ts`,
`src/transform/campCHeuristics.ts`, `src/transform/campCRejects.ts`.

### 8. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/campC.ts` | Create | Camp C dispatch entry. |
| `packages/pine-converter/src/transform/campCHeuristics.ts` | Create | H1/H2/H3 heuristics. |
| `packages/pine-converter/src/transform/campCRejects.ts` | Create | Reject table + suggestion templates. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-12 codes. |
| `packages/pine-converter/src/transform/campC-heuristics.test.ts` | Create | Heuristic tests. |
| `packages/pine-converter/src/transform/campC-rejects.test.ts` | Create | Reject tests. |
| `packages/pine-converter/src/transform/strict-mode.test.ts` | Create | Strict-mode behavior tests. |
| `packages/pine-converter/src/transform/campC-property.test.ts` | Create | Property: no silent drops. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-camp-c.md` — patch bump.

## Acceptance Criteria

- A push-without-eviction fixture with `max_lines_count=30` is
  promoted to Camp B with K=30 + `camp-c-heuristic-applied` info.
- A `linefill.new(array.get(a, i), array.get(b, j))` fixture emits
  `cross-collection-linefill` error with the suggested-rewrite text
  present in `diagnostic.suggestion`.
- Strict mode of the above fixture produces `output: null`.
- Default mode of the above fixture produces output with a comment
  `// [pine-converter] HARD-REJECT (cross-collection-linefill) …`.
- Property test: across 50 random Camp C fixtures, each produces
  either exactly one heuristic-applied diagnostic or exactly one
  reject.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
