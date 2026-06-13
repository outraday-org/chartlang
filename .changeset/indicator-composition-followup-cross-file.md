---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-conformance": minor
---

Light up the end-to-end cross-file dep path for indicator composition. The
compiler's `rewriteDependencyAccessors` transformer now collapses
`const <alias> = <root>.withInputs({...})...` chains to the bare root
identifier so the runtime sentinel never fires at module load; the merged
effective inputs flow through the `__dependencies[i].inputOverrides` slot
into the runtime's `DepRunner`. Cross-file producers' `@invinite-org/chartlang-core`
imports are hoisted above the inlined IIFE so esbuild dedupes them against
the consumer's imports and pulls in every symbol the producer uses
(`input.int`, `ta.ema`, …). The `__dependencies` export is now prepended
pre-bundle so esbuild's tree-shaker keeps each alias binding alive. The
`dep-cross-file` conformance scenario joins `ALL_SCENARIOS` and the suite
runs 225 scenarios green.
