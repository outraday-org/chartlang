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

Fix end-user-blocking Node-ESM packaging bug. Every published `dist/index.js` previously failed to load under Node's strict ESM resolver because `tsc` had been configured with `moduleResolution: "Bundler"` and emitted relative specifiers verbatim, so `dist/index.js` carried `from "./api"` (extensionless) and Node rejected the resolution. Workspace consumers never saw this because tsx / vitest / Vite resolve loosely, but `npm install @invinite-org/chartlang-compiler` followed by `import` failed immediately for any Node consumer, and `examples/react-demo/vite.config.ts`'s server-side compile plugin broke at dev-config-load time.

This release switches `tsconfig.base.json` to `module: "NodeNext"` / `moduleResolution: "NodeNext"`, and rewrites every relative import / export / dynamic-import / `typeof import("…")` specifier across all packages' source to carry an explicit `.js` (or `/index.js`) suffix. The new resolution mode also surfaces this bug class as a compile error rather than runtime breakage, so it cannot regress.

No behavioural change for runtime consumers — the rewritten specifiers resolve to the same TypeScript sources at build time and the same `dist/<path>.js` files at consumer-load time.
