---
"@invinite-org/chartlang-host-quickjs": patch
---

Make `createQuickJsHost` importable inside a Cloudflare Worker / Durable Object.
The host no longer `readFileSync`s `dist/dispatcher.js` at module scope — the
dispatcher bundle is inlined as a build-time `DISPATCHER_SOURCE` string constant
(generated into `src/dispatcherSource.generated.ts` by `scripts/buildDispatcher.ts`,
the same `bundleDispatcher()` source of truth as `dist/dispatcher.js`), so the
runtime path has zero `node:fs` / `node:path` / `node:url` imports and loads in
any runtime (DO, browser, Node). No public API change: `getQuickJS` stays the
default `quickJsLike`, and the dispatcher contents are unchanged (byte-identical
`dist/dispatcher.js`). The `dispatcherFreshness` gate now also asserts the
generated constant matches `bundleDispatcher()`, and a new no-filesystem
regression test locks in the DO-compat guarantee.
