---
"@invinite-org/chartlang-host-quickjs": patch
---

Extract the QuickJS dispatcher's pure logic into `dispatcherCore.ts` so the host-realm tests can exercise it directly while `dispatcher.ts` remains the thin guest-realm entry that hardens guest globals and wires `globalThis.__chartlang_*`. No observable behaviour change — the bundled `dist/dispatcher.js` still installs the same handlers and the integration / sandbox / conformance tests are unchanged.
