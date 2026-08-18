# packages/language-service/

`@invinite-org/chartlang-language-service` — the headless, editor-agnostic
intelligence surface (`compileToDiagnostics`, `getHoverDoc`, `getCompletions`,
`getSignatureHelp`, `getDefinition`, `getAvailableIntervals`).

## Invariants

- **`getDefinition` resolves exactly two things, and one of them is a stub.**
  A stdlib FQN present in `HOVER_REGISTRY` returns the hardcoded placeholder
  `{ file: "packages/core/dist/index.d.ts", line: 1, column: 1 }` — that path
  is not a real location and does not exist in a browser bundle; treat it as
  "this is a stdlib symbol", never as somewhere to navigate. Only
  `resolveDepAccessorDefinition` (a `<binding>.output("title")` accessor
  resolved to the producer's `plot(..., { title })` call) returns a REAL
  position, stamped `{ file: SCRIPT_FILE_NAME, line, column }`, 1-based.
  **Local `const` bindings are NOT resolved** — a known limit, not a bug.
  Extending resolution to local bindings is its own task; do not fake it by
  widening the stdlib stub.

- **`SCRIPT_FILE_NAME` (`"script.chart.ts"`) is module-private** to
  `_lib/resolveDepAccessor.ts`. Consumers that must recognise an in-document
  target carry their own copy (the editor's
  `DEFAULT_SCRIPT_FILE_NAME` / `DefinitionExtensionOpts.scriptFileName`). If
  that name ever changes, both sides move together.

- **Capability filtering happens HERE, once.** `targetCapabilities` is a
  `createLanguageService` option; the returned surface is already filtered, so
  no editor extension may re-filter completions, signature help, or
  diagnostics.

- **`hoverRegistry.generated.ts` is generated** by
  `pnpm gen-hover-registry` from core's JSDoc and gated by `pnpm hover:check`.
  Never hand-edit it. `HoverRegistryEntry` carries no docs URL — a hover
  payload is title + summary + optional param table + examples, nothing more,
  so no consumer may promise a "docs link" it cannot get from here.
  **The key-count pin in `hoverRegistry.generated.test.ts` counts exported TYPES
  too.** Adding a namespace of N members moves it by N + 1 **plus one per
  exported type alias** — `order.*` moved it by 9 (namespace + 4 members + the
  four `Order*` types), not the 5 a members-only count predicts. Regenerate and
  count the diff; never reason the delta out from the member list.

- **The Node compiler load is conditional.** `compileToDiagnostics` uses an
  injected `compileToDiagnostics` when supplied, else dynamically imports
  `@invinite-org/chartlang-compiler` only when `process.versions.node` exists.
  Browser hosts must inject; a static compiler import would break the bundle.
