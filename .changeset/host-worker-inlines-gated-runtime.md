---
"@invinite-org/chartlang-host-worker": patch
---

Rebuild `worker-boot` so it inlines the gated runtime.

`buildWorkerBoot.ts` bundles the runtime INTO `dist/worker-boot.js` at build
time, so the shipped bundle is a snapshot of whatever runtime version was
present when the package was last published — not of whatever a consumer later
resolves. `1.6.1` was published before the `unsupported-input-kind` gate
existed, and the previous release did not republish it, so
`unsupported-input-kind` appears nowhere in the package: browser and Web Worker
hosts silently keep the ungated `resolveInputs`, while the server path is gated
because `host-quickjs` DID republish for exactly this reason.

There is no source change here. The dependency is `workspace:^`, so publishing
is itself the fix: the rebuild inlines the current runtime and the release
rewrites the range to the gated version.

The same shape will recur for any future runtime change. `host-worker` and
`host-quickjs` both inline, so both must be republished whenever runtime
behaviour changes, even when neither has a source edit.
