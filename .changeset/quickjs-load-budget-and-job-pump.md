---
"@invinite-org/chartlang-host-quickjs": minor
---

Enforce a budget on `load()`, drain the guest job queue, and fail closed after an aborted step.

**`load()` was not interruptible at all.** The interrupt handler only fired while a
`push()` was in flight, and `maxLoadTimeoutMs` had no enforcement point anywhere —
neither host-side nor in the dispatcher. A compiled module whose TOP LEVEL looped
therefore ran unbounded: measured at 3063 ms with `maxStepMs: 1` and
`maxLoadTimeoutMs: 50` both set, and unbounded for a genuine infinite loop. That is a
blocked thread, so no `Promise.race` or timeout on the caller's side can recover it.
The interrupt handler now reads an armed deadline carrying its own budget: `push()`
arms `maxStepMs`, `load()` arms `maxLoadTimeoutMs`.

**`executePendingJobs()` was called once and its result discarded.** It stops on the
first exception with jobs still queued, and returns that exception. Dropping it strands
the job that settles the reply promise, so the `await` in `resolveStringPromise` can
never return — no error, no rejection, just a call that stands still. The queue is now
pumped until empty and a stopped queue raises `QuickJsStepAbortedError`. (For a guest
whose promises are settled by guest jobs alone, which is what this host installs, that
is a complete guarantee; a host-resolved promise would still need a wall-clock
deadline.)

**BREAKING for callers that continue after an interrupted step.** An aborted step leaves
`ta` state truncated, so the host is now poisoned: `drain()` / `exportSnapshot()` /
`importSnapshot()` throw `QuickJsStepAbortedError` and further `push()`es report through
`onHostError` and no-op. Previously the truncated state was served as if it were a
result, producing silently wrong values on every later bar. Catch the error, `dispose()`,
and build a new host. OOM is deliberately unchanged — the heap is exhausted, the
computation is not cut short — and `dispose()` works on a poisoned host.

Also fixes a QuickJS `list_empty(&rt->gc_obj_list)` assertion on teardown: guest runner
disposal is async, so `dispose()` now drains the resulting job before freeing the runtime.

New export: `QuickJsStepAbortedError`. `QuickJsRuntimeLike` gains an OPTIONAL
`hasPendingJob?()`, so existing structural implementations stay valid.
