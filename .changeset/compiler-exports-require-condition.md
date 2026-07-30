---
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-adapter-kit": patch
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-examples": patch
---

Add a `default` condition to every `exports` entry and a `./package.json`
subpath so CJS `require.resolve` no longer throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Hosts resolve the installed compiler to read
its version through `require.resolve`; without a `require`/`default`-matching
condition that resolution failed. ESM `import` resolution is unchanged.
