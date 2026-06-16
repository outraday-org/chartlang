---
"@invinite-org/chartlang-adapter-kit": patch
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-editor": patch
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-language-service": patch
"@invinite-org/chartlang-runtime": patch
---

Inline original TypeScript sources into emitted `.js.map` files (`inlineSources: true`). Published sourcemaps no longer reference missing `../src/*.ts` files, fixing "points to missing source files" warnings in downstream bundlers (e.g. Vite).
