# Task 17 — Diagnostics framework + source-span propagation

> **Status: TODO**

## Goal

Consolidate the diagnostic codes scattered across Tasks 3–16 into a
single registry with a stable contract (code → severity, default
message, default suggestion), provide a `DiagnosticCollector` API
every transform pass uses, and add source-span propagation so that
every diagnostic — including those emitted deep in transform passes —
points at the correct Pine source line/column. Finalize the
human-readable formatter for CLI output.

## Prerequisites

Task 16 (codegen lands; the full pipeline now runs and the
diagnostics from earlier tasks are visible).

## Current Behavior

Each transform task has been pushing diagnostics into a
`DiagnosticCollector` parameter. The collector itself was sketched
informally in Task 3 (`src/diagnostics/codes.ts`). Source spans are
attached at parse time but may be lost when transform passes
synthesize new diagnostics (e.g. a Camp B classification diagnostic
that originates from analyzing a span across multiple statements).

## Desired Behavior

`src/diagnostics/` exports:

- `DiagnosticCollector` class with `push(code, span, opts?)`,
  `errors()`, `warnings()`, `infos()`, `all()`, `frozen()`.
- `DIAGNOSTIC_CODES` registry — `ReadonlyMap<string,
  DiagnosticCodeEntry>` consolidating every code from Tasks 3–16 with
  stable IDs, severities, default messages, and default suggestions.
- `formatDiagnostic(diagnostic, source): string` — renders a
  diagnostic to a multi-line human-readable form with source-line
  excerpt and underline.
- `formatDiagnosticReport(diagnostics, source): string` — renders the
  full report grouped by severity.

## Requirements

### 1. `DIAGNOSTIC_CODES` consolidation

Read every diagnostic code added in Tasks 3–16 and consolidate into
`src/diagnostics/codes.ts`:

```ts
export type DiagnosticCodeEntry = Readonly<{
    code: string;
    severity: DiagnosticSeverity;
    defaultMessage: string;
    defaultSuggestion?: string;
    docsLink?: string;     // URL to the docs page for this diagnostic
}>;

export const DIAGNOSTIC_CODES: ReadonlyMap<string, DiagnosticCodeEntry>;
```

The full code list (consolidated from prior tasks):

| Task | Codes |
|---|---|
| 3 | `unsupported-pine-version`, `missing-version-directive`, `unsupported-strategy`, `unsupported-library`, `unsupported-for-in`, `unsupported-while`, `expected-token`, `unexpected-token` |
| 4 | `unsupported-udt`, `unsupported-method`, `unsupported-library-import`, `mixed-named-positional-args`, `chained-ternary-warning` |
| 5 | `accidental-shadowing`, `history-on-non-series`, `unknown-identifier`, `dynamic-handle-collection`, `unbounded-handle-collection` |
| 7 | `requires-bar-interval`, `dynamic-bar-index`, `unresolved-bar-index`, `chart-point-from-index-without-xloc` |
| 8 | `indicator-arg-not-mapped`, `drawing-only-script`, `strategy-as-indicator`, `computed-indicator-title`, `max-count-out-of-range` |
| 9 | `input-arg-not-mapped`, `non-literal-source-input`, `input-enum-rejected`, `inline-input-promoted`, `non-literal-input-default` |
| 10 | `yloc-padding-approximated`, `varip-approximated`, `cross-mount-state-not-preserved`, `label-style-not-mapped`, `setter-fold-cross-branch` |
| 11 | `ring-eviction-implicit`, `cap-mismatch`, `anchor-mirror-required`, `ring-buffer-zero-cap`, `negative-array-index`, `linefill-over-ring` |
| 12 | `camp-c-heuristic-applied`, `dynamic-handle-index`, `cross-collection-linefill`, `polyline-dynamic-points`, `handle-copy`, `handle-store-in-udt`, `for-in-line-all` (note: `unbounded-handle-collection` first registered by Task 5; Task 12 emits but does not re-register) |
| 13 | `table-multi-init`, `table-cell-out-of-bounds`, `table-dynamic-loop`, `table-merge-fallback`, `table-clear-noop`, `table-bucket-cap-adjusted`, `table-formatting-not-mapped` |
| 14 | `polyline-curved-anchors-warning`, `polyline-closed-info`, `linefill-series-fill`, `linefill-color-transp-approximated` |
| 15 | `ta-signature-divergence`, `ta-not-mapped`, `math-not-mapped`, `str-format-not-mapped`, `str-not-mapped`, `fill-not-mapped`, `request-security-different-symbol`, `request-security-lookahead-not-supported`, `request-security-not-mapped`, `strategy-signal-only`, `dynamic-series-index`, `loop-bounds-not-literal-for-stateful-body`, `loop-body-unrolled`, `mtf-series-to-scalar-conversion` |
| 16 | `codegen-output-invalid` |

A test asserts that **every** code emitted by any source file is
present in `DIAGNOSTIC_CODES` (cross-checked via grep). New codes added
after this task must be registered here.

### 2. `DiagnosticCollector` API

```ts
export class DiagnosticCollector {
    push(code: string, span: SourceSpan, opts?: {
        message?: string;       // override default
        suggestion?: string;    // override default
    }): void;
    errors(): readonly Diagnostic[];
    warnings(): readonly Diagnostic[];
    infos(): readonly Diagnostic[];
    all(): readonly Diagnostic[];
    /** Returns a frozen `readonly Diagnostic[]` for `ConvertResult.diagnostics`. */
    frozen(): readonly Diagnostic[];
    /** Strict mode upgrade — warnings become errors. */
    upgradeWarningsToErrors(): DiagnosticCollector;
}
```

The collector resolves the code → severity / defaultMessage /
defaultSuggestion at push time, applying any overrides. This
centralizes the "what does this code look like" decision.

### 3. Source-span propagation guarantees

Audit every transform pass and ensure every diagnostic push includes a
non-default span:

- Pass-time check: when a pass produces synthesized AST nodes (e.g.
  the unrolled loop bodies in Tasks 11/13), the synthesized nodes
  carry the originating span.
- Test: a property test reads every emitted diagnostic from a
  representative fixture set and asserts `span.startLine !== 0 &&
  span.startColumn !== 0`.

If any pass lacks an obvious span, the convention is to attach the
nearest enclosing statement's span and emit a follow-up info
`diagnostic-span-approximated`.

### 4. Human-readable formatter

`formatDiagnostic(d, source)`:

```
error[camp-c.cross-collection-linefill]: linefill across two collections has no chartlang analogue
   --> fixtures/example.pine:42:9
    |
 42 |     linefill.new(array.get(linesA, i), array.get(linesB, j))
    |     ^^^^^^^^^^^^ here
    = suggestion: linefill across two collections has no chartlang analogue. Consider a single `draw.path(...)` over the pair of anchor points instead.
    = docs: https://chartlang.dev/converter/diagnostics/cross-collection-linefill
```

For multi-line spans, render the start line with `^^^` underline of
the start column extent + `...` plus the end line with `^^^` underline
back to the end column. Lifted from `tsc` / `rustc` diagnostic style.

### 5. Report formatter

`formatDiagnosticReport(diagnostics, source)`:

```
==== converter diagnostics ====
errors:   3
warnings: 12
infos:    5

[errors]
<formatted error 1>
<formatted error 2>
<formatted error 3>

[warnings]
<formatted warning 1>
...
```

Used by the CLI (Task 18) when the user passes `--report` or stderr is
detected as a TTY.

### 6. JSON output mode

The CLI also needs a `--diagnostics-json` mode that emits the
`readonly Diagnostic[]` directly serialized to stdout. Provide a
`formatDiagnosticsJson(diagnostics)` helper (just `JSON.stringify`
with a stable property order — code/severity/message/span/suggestion).

### 7. Docs links

Each `DiagnosticCodeEntry` carries an optional `docsLink`. For v1,
these all point at a single page `https://chartlang.dev/converter/
diagnostics` (Task 20 ships the page); the per-code anchor is
`#<code>`. Anchors are auto-generated from the code.

### 8. Tests (§16.3)

| File | Purpose |
|------|---------|
| `codes.test.ts` | Every code in `DIAGNOSTIC_CODES` has a non-empty `defaultMessage`. Severity matches the per-task spec. |
| `collector.test.ts` | `push` resolves overrides correctly; `upgradeWarningsToErrors` flips severities. |
| `format.test.ts` | Snapshot tests of the human-readable format for one of each severity (error/warning/info). |
| `format-report.test.ts` | Snapshot test for the grouped report. |
| `format-json.test.ts` | Stable property ordering for the JSON form. |
| `code-coverage-grep.test.ts` | Use the TypeScript Compiler API (NOT a regex) to walk `src/**` and find every `DiagnosticCollector.push("<literal>", ...)` call. Assert the first argument literal is registered in `DIAGNOSTIC_CODES`. The regex form (`/\b[a-z]+(?:-[a-z]+)+\b/`) is too loose — it matches kebab-case names that aren't diagnostic codes (`camp-a`, `kebab-case`, etc.) and would fail CI on harmless additions. |
| `span-propagation.property.test.ts` | Property: for 30 representative fixtures, every emitted diagnostic has a non-zero span. |

Coverage 100% on `src/diagnostics/`.

### 9. JSDoc

Every exported function/class/type carries `@since 0.1`,
`@experimental`, and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Consolidate codes; export `DIAGNOSTIC_CODES`. |
| `packages/pine-converter/src/diagnostics/collector.ts` | Create | `DiagnosticCollector` class. |
| `packages/pine-converter/src/diagnostics/format.ts` | Create | Human-readable formatter. |
| `packages/pine-converter/src/diagnostics/formatReport.ts` | Create | Grouped report formatter. |
| `packages/pine-converter/src/diagnostics/formatJson.ts` | Create | JSON serializer. |
| `packages/pine-converter/src/diagnostics/index.ts` | Modify | Re-export. |
| Tests (per the table above) | Create | §16.3 layer set. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-diagnostics.md` — patch bump.

## Acceptance Criteria

- `code-coverage-grep.test.ts` passes — every diagnostic-like string
  pushed via the collector is registered.
- `formatDiagnostic(d, source)` snapshot matches the rustc-style
  layout.
- `upgradeWarningsToErrors()` turns a warning into an error in the
  collector.
- Property test: 30 fixture conversions produce zero diagnostics with
  a zero-span.
- 100% coverage on `src/diagnostics/`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
