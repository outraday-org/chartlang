---
"@invinite-org/chartlang-compiler": minor
---

Stamp `manifest.compilerVersion` on every compiled artifact.

`buildManifest` now emits the compiler's own package version on each manifest
it builds (including sibling manifests), so a consumer can key an artifact
cache — or fill the `compilerVersion` slot of a `StateStoreKey` — from
`compiled.manifest` alone, with no `package.json` read and no
`require.resolve`. The value also rides the serialized `__manifest` tail, so it
crosses the host-worker and QuickJS boundaries with the manifest it belongs to.

The constant lives in a generated `src/version.generated.ts` emitted from
`package.json` by `pnpm compiler:version:generate`; `pnpm compiler:version:gate`
fails the build on drift, and the generator is chained into
`pnpm changeset:version` so a release commit can never ship a stale stamp. The
compiler's ambient `@invinite-org/chartlang-core` shim mirrors the new manifest
field in lockstep.
