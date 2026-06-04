# packages/compiler/

`@invinite-org/chartlang-compiler` — TS-AST transformer + esbuild-driven bundler.

## Invariants

- **Callsite-id format is load-bearing.** Slot ids follow
  `<sourcePath>:<line>:<col>#<callIndex>` (§5.5). Lines and columns are
  1-based, read from the **input** source file before any rewrite. The
  runtime keys per-script state on this exact string — change the format
  and every cached state goes stale. Hand-written code always uses
  `callIndex = 0`; non-zero is reserved for future macros.
- **Static-analysis runs on the original AST.** `structuralChecks`,
  `forbiddenConstructs`, and `statefulCallInLoop` operate on the source
  file as parsed; the transformer is a pure rewrite step that never
  mutates input nodes. Extractors (capabilities / max-lookback / inputs)
  also run on the original AST — the rewrite is only for the bundler in
  Task 3.
- **No DOM lib.** `program.ts` pins `lib: ["lib.es2022.d.ts"]` on the
  in-memory program so scripts cannot rely on browser globals. Hostile
  globals (`Math.random`, `Date`, `fetch`, `setTimeout`, …) are
  separately rejected by `forbiddenConstructs`.
- **Core resolves through an ambient shim.** `program.ts` ships a
  hand-rolled `.d.ts` for `@invinite-org/chartlang-core` so the compiler
  is host-machine independent and deterministic. The shim must stay in
  lockstep with `packages/core/src/` — every new core export needs a
  matching declaration here.
- **Determinism is testable.** `transformAndAnalyse(src, opts)` printed
  twice must yield byte-identical strings via `ts.createPrinter`. Slot
  ids are pure string literals, never template strings or symbol
  references. The same goes for `compile`'s `moduleSource` — esbuild's
  `transform` output is deterministic with fixed flags and the
  `__manifest` JSON keys land in `buildManifest` insertion order.
- **`__manifest` shape is `export const`.** `bundle.ts`'s
  `formatManifestAssignment` emits `export const __manifest = …;` so the
  runtime can recover the manifest via dynamic `import(...)`. The `.d.ts`
  sibling (`typesEmit.ts`) declares the symbol in lockstep — both halves
  must stay aligned.
- **`compileFile` writes are atomic.** `writeAtomic` renders to a
  `<target>.tmp.<rand>` sibling and `rename`s into place; on failure the
  temp file is unlinked. Anyone touching `compileFile` must preserve this
  contract — half-written triples are worse than no triple.
- **`compileProject` does not write.** It walks the directory in
  parallel + collects results in memory. The CLI loops `compileFile`
  itself when sibling files are needed (Phase-1 Task 11).
