---
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-host-quickjs": patch
---

Rebundle both hosts against the re-seed runtime so an overlapping `history`
re-push into a non-fresh runner replays external-series feeds / plot overrides
from bar 0 (instead of appending at `N..2N-1`); forward-continuation batches
still append. No host code changes — both hosts forward
`history` frames verbatim and inherit the runtime's `resetStateForHistoryReseed`
semantics — but the committed bundles (`host-worker`'s `dist/worker-boot.js`,
`host-quickjs`'s `dist/dispatcher.js` + `dispatcherSource.generated.ts`) are
regenerated so the published packages carry the fix. Cross-host parity is pinned
by new worker-boot + QuickJS integration tests and a `history-reseed-feed`
conformance scenario.
