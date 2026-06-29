# Accept Pine v5 Scripts

> **Status: TODO**

## Goal

Allow `//@version=5` scripts to convert instead of being hard-rejected
with `unsupported-pine-version`. The version gate is a pure header check
and the transform pipeline is version-agnostic, so v5 should convert
through the existing supported subset — but emit a non-error
`pine-version-downlevel` warning so authors know un-modelled v5/v6
semantic deltas are their responsibility.

## Prerequisites

None.

## Current Behavior

`packages/pine-converter/src/parser/declarations.ts` records
`unsupported-pine-version` (severity **error**) whenever the parsed
version `!== 6`:

```ts
// declarations.ts (~line 76)
if (version !== 6) {
    ctx.addDiagnostic(makeDiagnostic("unsupported-pine-version", token.span));
}
```

The diagnostic is non-fatal to parsing (the version is still recorded
and the AST returned), but it is error-severity, so a clean conversion
is impossible. Diagnostic definition: `src/diagnostics/codes.ts`
(`unsupported-pine-version`, `pine-converter/parse/unsupported-pine-version`,
severity `error`, message "Only Pine Script v6 is supported.").

The lexer already tokenises v5 syntax (it emits a `version-directive`
token for any `\d+`), so nothing downstream depends on the version
being 6.

## Desired Behavior

- `//@version=6` → no version diagnostic (unchanged).
- `//@version=5` → a `pine-version-downlevel` **warning**, conversion
  proceeds.
- Any other version (`4`, `7`, …) → `unsupported-pine-version` error
  (unchanged).

## Requirements

### 1. Add the `pine-version-downlevel` diagnostic

Append to `DIAGNOSTIC_CODE_ENTRIES` in `src/diagnostics/codes.ts` (append
only — never reorder/rename existing codes):

```ts
"pine-version-downlevel": {
    code: "pine-converter/parse/pine-version-downlevel",
    severity: "warning",
    defaultMessage:
        "Pine v5 is converted on a best-effort basis through the v6 subset; un-modelled v5/v6 semantic differences may not be reflected.",
    defaultSuggestion:
        "Review the converted output, or migrate the source to `//@version=6`.",
},
```

### 2. Branch the version check

In `src/parser/declarations.ts`, replace the single `!== 6` guard with:

```ts
if (version === 5) {
    ctx.addDiagnostic(makeDiagnostic("pine-version-downlevel", token.span));
} else if (version !== 6) {
    ctx.addDiagnostic(makeDiagnostic("unsupported-pine-version", token.span));
}
```

Keep the existing recording of the version on the AST node unchanged.

### 3. Golden fixture

Add the next-numbered fixture trio under `packages/pine-converter/fixtures/`
(use the current next index — see the count assertion in
`golden.test.ts`). Minimal `.pine`:

```pine
//@version=5
indicator("v5 downlevel", overlay=true)
ma = ta.sma(close, 14)
plot(ma)
```

Regenerate the `.expected.chart.ts` + `.expected.diagnostics.json` with
`UPDATE_FIXTURES=1` and confirm the diagnostics snapshot contains
exactly one `pine-version-downlevel` warning (and the chart output is a
normal SMA plot).

### 4. Unit test

Add a focused parser test (next to existing parser tests) asserting:
`//@version=5` produces a `pine-version-downlevel` warning and no
error; `//@version=4` still produces `unsupported-pine-version`;
`//@version=6` produces neither.

### 5. Regenerate diagnostics docs

Run `pnpm converter:docs:generate` so `docs/converter/diagnostics.md`
gains the new code (gated by `converter:docs:check`).

### 6. Update CLAUDE.md

In `packages/pine-converter/CLAUDE.md`, under the Parser /
version-directive invariant, note that v5 is accepted with a downlevel
warning (v4 and below still rejected).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/diagnostics/codes.ts` | Modify | Append `pine-version-downlevel` |
| `src/parser/declarations.ts` | Modify | Branch v5 → warning |
| `src/parser/declarations.test.ts` (or existing parser test) | Modify | Version-branch coverage |
| `fixtures/NN-pine-v5-downlevel.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `docs/converter/diagnostics.md` | Regenerate | Doc gate |
| `packages/pine-converter/CLAUDE.md` | Modify | Invariant note |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage)
- `pnpm converter:docs:check`

## Changeset

`.changeset/converter-accept-pine-v5.md` — `@invinite-org/chartlang-pine-converter: minor` (new user-facing capability).

## Acceptance Criteria

- v5 scripts convert with a single `pine-version-downlevel` warning; v4
  and below still error with `unsupported-pine-version`.
- Golden fixture trio added; `golden.test.ts` count assertion bumped.
- 100% coverage maintained on `pine-converter`.
- `docs/converter/diagnostics.md` regenerated and committed.
- `CLAUDE.md` invariant updated.
- Changeset committed.
