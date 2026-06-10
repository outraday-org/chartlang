---
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-language-service": patch
"@invinite-org/chartlang-conformance": patch
---

Surface TypeScript semantic type errors from `compile()` and `createLanguageService().compileToDiagnostics()`.

The compiler was creating a `ts.Program` for symbol resolution but never requesting `program.getSemanticDiagnostics(sourceFile)`, so scripts like `const x: number = "oops"` slipped past the gate and reached the runtime. The pipeline now wires the program's semantic diagnostics into `transformAndAnalyse`, filtered to the user's source file and mapped to a new stable `type-error` diagnostic code (with the original `TS<code>` prefix preserved in the message so editor tooling can route to TypeScript documentation).

Companion fix: the in-memory `@invinite-org/chartlang-core` ambient shim in `packages/compiler/src/program.ts` was significantly out of lockstep with the real core surface. The shim now ships the full 61-method `DrawNamespace`, every missing `TaNamespace` method (`adx`, `dmi`, `trix`, `ichimoku`, `tsi`, `smi`, `pmo`, `stochRsi`, `ultimateOsc`, `coppock`, `vortex`, `trendStrengthIndex`, `ulcerIndex`, `adr`, `median`), and `ScalarOrSeries`-widened `ta.*` source parameters that match the runtime's `readSourceValue` contract.
