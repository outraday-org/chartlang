# Task 13 — Language-service: hover registry + LSP-style API

> **Status: TODO**

## Goal

Promote `@invinite-org/chartlang-language-service` from the
PACKAGE_VERSION placeholder to a real LSP-style headless service
per PLAN.md §14.1. Ship the build-time JSDoc → hover-doc registry
generator script, the six public methods on
`createLanguageService(opts)`, and the
`targetCapabilities`-aware completion source for interval string
literals.

## Prerequisites

- Task 12 (runtime is at Phase-4 baseline so end-to-end
  compile-to-diagnostics flow works).

## Current Behavior

- `packages/language-service/src/index.ts` exports only
  `PACKAGE_VERSION = "0.0.0"`.
- No registry, no LSP-style methods.
- `pnpm test` on the package passes because the placeholder file
  is excluded from coverage.

## Desired Behavior

- `scripts/gen-hover-registry.ts` walks `@invinite-org/chartlang-
  core`'s `.ts` source files (or its compiled `.d.ts` bundle),
  extracts every exported symbol's JSDoc (description, `@param`,
  `@example`, `@since`), and writes
  `packages/language-service/src/hoverRegistry.generated.ts`. The
  registry is checked in; CI re-runs the generator and fails on
  diff (mirrors `pnpm docs:check`).
- `createLanguageService(opts?)` returns:
  - `compileToDiagnostics(source) → Promise<LspDiagnostic[]>` —
    delegates to `@invinite-org/chartlang-compiler` and maps
    error codes to `LspDiagnostic`.
  - `getHoverDoc(source, offset) → HoverDoc | null` — resolves
    the symbol under cursor via the TS LanguageService, looks up
    in the registry, returns the `HoverDoc`.
  - `getCompletions(source, offset) → CompletionItem[]` —
    in-scope identifiers + registry items. When the cursor is
    inside a `request.security({ interval: "▮" })` or
    `input.interval("▮")` literal AND `targetCapabilities` is
    supplied, returns one item per
    `targetCapabilities.intervals` entry.
  - `getSignatureHelp(source, offset) → SignatureHelp | null` —
    parameter info for stateful calls.
  - `getDefinition(source, offset) → DefinitionLocation | null`
    — jumps into core's `.d.ts`.
  - `getAvailableIntervals() → ReadonlyArray<IntervalDescriptor>`
    — returns `targetCapabilities?.intervals ?? []`.
- Capability-aware completions also gate plot kinds (return
  hint when targeting an adapter that doesn't ship a referenced
  kind).

## Requirements

### 1. `scripts/gen-hover-registry.ts`

Build-time generator. Walks `packages/core/src/**/*.ts`, parses
JSDoc via the TS API, builds the registry. Excludes
`*.test.ts`, `__fixtures__`, and `index.ts` barrels.

Registry shape:

```ts
type HoverRegistryEntry = Readonly<{
    fqn: string;           // e.g. "ta.ema", "draw.line", "input.int"
    kind: "function" | "namespace" | "property" | "type";
    title: string;          // e.g. "ta.ema(source, length, opts?)"
    summary: string;        // first paragraph of JSDoc
    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;
    examples?: ReadonlyArray<string>;
    since: string;          // "0.1" / "0.2" / "0.4"
    stability: "stable" | "experimental";
}>;

export const HOVER_REGISTRY: Readonly<Record<string, HoverRegistryEntry>>;
```

Output file:
`packages/language-service/src/hoverRegistry.generated.ts` —
checked in. Two-line MIT header + a generator stamp comment.

Generator CLI: `pnpm gen-hover-registry` (root package script
running `pnpm tsx scripts/gen-hover-registry.ts`). Add a CI gate
`hover:check` that re-runs and fails on diff. Posture mirrors the
existing `pnpm docs:check` and `pnpm readme:check` scripts.
(Note: `pnpm docs:generate` runs via `pnpm chartlang docs` — the
CLI's `docs` command — so the new hover-registry generator stands
alone as `scripts/gen-hover-registry.ts`; it is not folded into
the `chartlang` CLI.)

### 2. `packages/language-service/src/types.ts`

LSP-style types (verbatim from PLAN §14.1):

```ts
export type LspRange = Readonly<{ startLine: number; startColumn: number; endLine: number; endColumn: number }>;
export type LspSeverity = "error" | "warning" | "info" | "hint";
export type LspDiagnostic = Readonly<{
    range: LspRange;
    severity: LspSeverity;
    code: string;       // diagnostic code from the compiler / runtime
    message: string;
    relatedCallsite?: string;
}>;
export type HoverDoc = Readonly<{
    title: string;
    summary: string;
    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;
    examples?: ReadonlyArray<string>;
}>;
export type CompletionItem = Readonly<{
    label: string;
    kind: "function" | "namespace" | "property" | "enumMember" | "keyword";
    insertText: string;
    detail?: string;
    doc?: HoverDoc;
}>;
export type SignatureHelp = Readonly<{
    label: string;
    parameters: ReadonlyArray<{ name: string; doc: string }>;
    activeParameter: number;
}>;
export type DefinitionLocation = Readonly<{
    file: string;
    line: number;
    column: number;
}>;
export type LanguageServiceOptions = Readonly<{
    targetCapabilities?: Capabilities;
}>;
```

### 3. `packages/language-service/src/createLanguageService.ts`

```ts
import { compile } from "@invinite-org/chartlang-compiler";
import { HOVER_REGISTRY } from "./hoverRegistry.generated";

export function createLanguageService(opts: LanguageServiceOptions = {}) {
    const capabilities = opts.targetCapabilities;
    return {
        async compileToDiagnostics(source: string): Promise<ReadonlyArray<LspDiagnostic>> {
            const result = await compile(source, { /* … */ });
            return result.diagnostics.map(mapDiagnostic);
        },
        getHoverDoc(source: string, offset: number): HoverDoc | null {
            const fqn = resolveFqnAtOffset(source, offset);
            if (!fqn) return null;
            const entry = HOVER_REGISTRY[fqn];
            return entry ? toHoverDoc(entry) : null;
        },
        getCompletions(source: string, offset: number): ReadonlyArray<CompletionItem> {
            // 1. Inside interval string literal? Return intervals.
            if (capabilities && isInsideIntervalLiteral(source, offset)) {
                return capabilities.intervals.map((d) => ({
                    label: d.value,
                    kind: "enumMember" as const,
                    insertText: d.value,
                    detail: d.label,
                    doc: { title: d.value, summary: `Group: ${d.group}` },
                }));
            }
            // 2. Generic identifier completions from the registry + in-scope.
            return collectCompletions(source, offset, HOVER_REGISTRY);
        },
        getSignatureHelp(source: string, offset: number): SignatureHelp | null { /* … */ return null; },
        getDefinition(source: string, offset: number): DefinitionLocation | null { /* … */ return null; },
        getAvailableIntervals(): ReadonlyArray<IntervalDescriptor> {
            return capabilities?.intervals ?? [];
        },
    };
}
```

### 4. `packages/language-service/src/_lib/`

Helpers: `resolveFqnAtOffset.ts`, `isInsideIntervalLiteral.ts`,
`collectCompletions.ts`, `mapDiagnostic.ts`, `toHoverDoc.ts`.
Each ~30–50 lines with unit tests.

### 5. `packages/language-service/src/index.ts` — public surface

```ts
export { createLanguageService } from "./createLanguageService";
export type {
    CompletionItem, DefinitionLocation, HoverDoc,
    LanguageServiceOptions, LspDiagnostic, LspRange, LspSeverity,
    SignatureHelp,
} from "./types";
```

### 6. Tests

- **`createLanguageService.test.ts`** — unit tests on every
  method using a small in-memory script + `targetCapabilities`.
  Cover:
  - `compileToDiagnostics` returns mapped diagnostics for a
    syntax error.
  - `getHoverDoc("import { ta } from ...; ta.ema(...)", offset
    inside ta.ema)` returns the registry entry.
  - `getCompletions` inside an `interval: "▮"` literal returns
    one item per `intervals` entry.
  - `getSignatureHelp` returns parameter info for
    `request.security`.
  - `getAvailableIntervals` returns `targetCapabilities.
    intervals`.
- **`hoverRegistry.generated.test.ts`** — assert cardinality
  (every PLAN-documented symbol present) + spot-check a few
  entries (`ta.ema`, `state.float`, `input.interval`,
  `request.security`).
- **`createLanguageService.golden.test.ts`** — hover + completion
  fixture goldens (per the §16.3 language-service table —
  golden layer required).

### 7. `scripts/gen-hover-registry.test.ts`

Walks a small fixture core directory, asserts the generated
registry shape matches an expected snapshot. Prevents silent
regressions in the JSDoc parser.

### 8. CI gate

Add both scripts to the root `package.json`:

```json
{
  "gen-hover-registry": "pnpm tsx scripts/gen-hover-registry.ts",
  "hover:check": "pnpm gen-hover-registry -- --check"
}
```

`hover:check` re-runs the generator and fails on diff. Add the
gate to the GitHub Actions workflow after `pnpm docs:gate`.

### 9. JSDoc gate

Every new export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/gen-hover-registry.ts` | Create | JSDoc-walker generator |
| `scripts/gen-hover-registry.test.ts` | Create | Generator unit test |
| `packages/language-service/src/createLanguageService.ts` | Create | LSP-style service |
| `packages/language-service/src/types.ts` | Create | LSP types |
| `packages/language-service/src/hoverRegistry.generated.ts` | Create (generated) | Registry data |
| `packages/language-service/src/_lib/resolveFqnAtOffset.ts` | Create | TS LS bridge |
| `packages/language-service/src/_lib/isInsideIntervalLiteral.ts` | Create | Cursor-in-string helper |
| `packages/language-service/src/_lib/collectCompletions.ts` | Create | Identifier walker |
| `packages/language-service/src/_lib/mapDiagnostic.ts` | Create | Compiler → LSP mapping |
| `packages/language-service/src/_lib/toHoverDoc.ts` | Create | Registry entry → HoverDoc |
| `packages/language-service/src/_lib/*.test.ts` | Create | Unit tests |
| `packages/language-service/src/createLanguageService.test.ts` | Create | API tests |
| `packages/language-service/src/createLanguageService.golden.test.ts` | Create | Hover + completion goldens |
| `packages/language-service/src/hoverRegistry.generated.test.ts` | Create | Generated-data sanity |
| `packages/language-service/src/index.ts` | Replace | Real exports |
| `packages/language-service/package.json` | Modify | Add `@invinite-org/chartlang-compiler` dependency |
| `package.json` (root) | Modify | Add `gen-hover-registry` + `hover:check` scripts |
| `.github/workflows/ci.yml` | Modify | Wire `hover:check` |

## Edge Cases

- **`hoverRegistry.generated.ts` is checked in** — same posture as
  `gen-docs.ts` outputs. CI fails on diff so the registry can't
  drift from JSDoc silently.
- **Two-line MIT header on generated file** + a clearly visible
  `// !!! GENERATED — DO NOT EDIT. Re-run pnpm gen-hover-registry.
  !!!` comment.
- **`targetCapabilities` is optional** — without it,
  `getAvailableIntervals()` returns `[]`,
  `isInsideIntervalLiteral` short-circuits to the generic
  completion path.
- **`mapDiagnostic`** — every compiler diagnostic code maps to
  an LSP severity. Default to `"error"`; some codes
  (`multi-timeframe-not-supported`, `unsupported-plot-kind`,
  `unsupported-drawing-kind`) map to `"warning"` per §7.4
  silent-degradation posture.
- **`getDefinition`** points into core's `.d.ts` — works because
  the consumer-side TS LanguageService resolves the import. Phase-
  5 Monaco / VSCode hosts get full source navigation.
- **Coverage** — `language-service/src/index.ts` barrel exempt;
  `hoverRegistry.generated.ts` is data, not logic — its
  coverage contribution is the test that reads it.
- **`createLanguageService.golden.test.ts`** — fixture goldens
  are SHA-256 over JSON-stringified HoverDoc / CompletionItem
  arrays. Re-pin from failure messages on intentional changes.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage on
  `@invinite-org/chartlang-language-service`),
  `pnpm docs:check`, `pnpm readme:check`,
  `pnpm hover:check` (new),
  `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-13-language-service.md` — **minor** on
`@invinite-org/chartlang-language-service` (first real release).

## Acceptance Criteria

- `createLanguageService({ targetCapabilities })` resolves all 6
  public methods.
- Hover registry covers every PLAN-documented public symbol from
  core.
- `getCompletions` inside an interval literal returns the
  capability list.
- `getAvailableIntervals` matches `targetCapabilities.intervals`.
- 100% coverage on the package (excluding the generated registry
  per coverage exempt rules).
- `pnpm hover:check` gate green.
- Phase-3 conformance suite still passes.
- Changeset committed.
