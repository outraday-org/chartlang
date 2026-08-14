---
"@invinite-org/chartlang-host-quickjs": minor
---

QuickJS dispatcher implements the `exportSnapshot` / `importSnapshot` verbs

`ScriptHost` is a type alias of host-worker's, so the two new methods arrive
here by inheritance — but inheriting the type is not shipping the verb. This
package's own output now carries all three pieces: the `exportSnapshot` /
`importSnapshot` arms of `HostToQuickJs` (plus the `snapshot` /
`snapshotImported` / `snapshotError` replies), the `createQuickJsHost` methods,
and the regenerated dispatcher bundle. Both are synchronous host→guest calls
like `drain`, and `createQuickJsHostOpts.stateStoreKey` rides the `load` frame
so the guest can stamp exports and refuse a foreign snapshot on import.

Semantics mirror host-worker exactly, refusal messages included: import only
after `load`, only before the first push, only for a matching `StateStoreKey`;
every refusal is a typed `snapshotError` frame rethrown as core's
`SnapshotError`, never a `fatal`. The one deliberate divergence is that `load`
carries no `persistence` descriptor — IndexedDB does not exist in this realm,
so automatic persistence stays a host-worker affordance and callers here own
their own storage.
