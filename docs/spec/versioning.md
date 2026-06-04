# apiVersion contract

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §3.3.

The `apiVersion` integer that every script and every package
declares: how the compiler refuses newer-than-pinned imports, how the
runtime enforces the same contract at load, and how adapters and
hosts advertise the maximum `apiVersion` they support. The
mechanism that keeps a script written today running tomorrow.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 compiler PR.
