---
"@invinite-org/chartlang-compiler": minor
---

Add an `inMemoryModules` option to `compile` (and `bundleModule`): a `{ [bareSpecifier]: selfContainedEsmSource }` map the esbuild bundling step resolves in-memory instead of from disk. This lets a host run the compiler where the workspace `@invinite-org/chartlang-*` packages are not installed as resolvable `node_modules` — e.g. a bundled serverless function, where the packages are inlined into the host bundle rather than shipped to the function filesystem. Each value must be pre-bundled (no remaining bare imports). When omitted, resolution stays on disk exactly as before.
