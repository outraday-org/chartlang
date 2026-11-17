---
"@invinite-org/chartlang-host-quickjs": patch
---

Fix a silent stall: a host read each `load` / `push` reply
through quickjs-emscripten's `resolvePromise`, which spends two 16-bit
host-function ids per call, so the 32,769th reply on one host never settled
(and every call leaked). The host now pumps the job queue and reads the
settled state with `getPromiseState` (`QuickJsContextLike.getPromiseState`,
optional; `resolvePromise` stays the fallback). A long-lived host — an alert
runner past ~32,000 bars — keeps going.
