# Version pinning

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §3.3.

How `apiVersion` works in chartlang: every script declares an
`apiVersion` integer in `defineIndicator`; the compiler refuses to
compile a script that imports symbols newer than that version; the
runtime enforces the same contract at load time. This is the
mechanism that keeps old scripts running unchanged forever.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 compiler PR.
