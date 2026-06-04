---
"@invinite-org/chartlang-compiler": minor
---

Phase-1 AST surface: `transformAndAnalyse(source, opts)` driver that runs the
TS program builder, the structural / forbidden-construct / stateful-call-in-loop
checks, the §5.5 callsite-id injection transformer, and the capability /
maxLookback / input extractors, then assembles a deeply-immutable
`ScriptManifest`. Public `CompileDiagnostic` + `CompileDiagnosticCode` types
cover all nine Phase-1 codes (`unbounded-loop`, `recursion-not-allowed`,
`hostile-global`, `stateful-call-inside-loop`, `dynamic-series-index`,
`callsite-id-conflict`, `missing-default-export`, `api-version-mismatch`, plus
the reserved `request-security-interval-not-literal`). Bundling and the public
`compile` / `compileFile` / `compileProject` API land in Task 3.
