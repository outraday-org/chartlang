---
"@invinite-org/chartlang-pine-converter": patch
---

Move `@invinite-org/chartlang-compiler` from `dependencies` to
`devDependencies`. The synchronous `convert` pipeline (lex → parse → semantic →
transform → codegen) never imports the compiler — it is used only by the
`emit-compile.test.ts` round-trip that verifies emitted output compiles. Keeping
it as a runtime dependency wrongly pulled the compiler (and its esbuild/Node
surface) into downstream bundlers' resolution graph; a devDependency is
sufficient for the tests and keeps the runtime dependency set empty.
