---
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
---

Split the fs-touching API out of the pine-converter root entry so the package
is genuinely browser-safe.

**Breaking:** `convertFile` and `ConvertFileOpts` no longer resolve from
`@invinite-org/chartlang-pine-converter`. They move to the new
`@invinite-org/chartlang-pine-converter/node` sub-export — the only entry that
imports `node:*`. The root entry now has zero `node:` specifiers at any depth
of its module graph (gated by a TS import-graph test), so `convert` resolves in
browsers, Deno and workers. `convert` and its types are otherwise unchanged.

Every `exports` entry also gains a `default` condition and the package gains a
`./package.json` subpath, matching the rest of the workspace: without a
condition that the `["node", "require", "default"]` set matches, CJS
`require.resolve` of the package or any of its subpaths throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`. ESM `import` resolution is unchanged.

`chartlang pine-convert` now imports `convertFile` from the `/node` subpath;
its behaviour and exit codes are unchanged.
