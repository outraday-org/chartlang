---
"@invinite-org/chartlang-cli": minor
---

Phase-2 Task 2 — `chartlang docs` subcommand + `gen-docs` generator.

Adds the `chartlang docs [--source <dir>] [--out <dir>]` subcommand
that walks every `ta.*` primitive source under
`packages/runtime/src/ta/`, parses each export's JSDoc (`@formula`,
`@warmup`, `@anchors`, `@since`, `@example`, stability marker) via
the TypeScript compiler API, and emits one
`docs/primitives/ta/<id>.md` per primitive following the §17.2
template. Pages open with the `<!-- AUTO-GENERATED -->` sentinel
so the `pnpm docs:gate` byte-equality check is robust.

The CLI's `runCli` dispatcher learns a `docs` case and re-exports
the new `runDocsCommand`, `runGenDocs`, `generateDocsPage`,
`parsePrimitiveSource`, `GenDocsError`, `AUTO_GENERATED_HEADER`,
and `findRepoRoot` programmatic surfaces.

Root scripts `pnpm docs:generate` (alias for `pnpm chartlang docs`)
and `pnpm docs:gate` (regenerates into a tmp dir, byte-diffs against
the committed tree) land alongside; CI runs `docs:gate` after
`docs:check`. The Phase-1 primitive pages (sma, ema, stdev, bb,
rsi, macd, atr, crossover, crossunder) ship in this changeset
together with a hand-written `docs/primitives/ta/index.md`.

`typescript` added as a runtime dependency of the CLI package
(previously a workspace-root devDep; the generator ships in the
published `dist/`).
