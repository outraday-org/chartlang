# Adapter capabilities

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §7.2.

The `Capabilities` surface: how an adapter declares which plot kinds,
drawing kinds, alert delivery channels, and input UI hints it supports.
Capability mismatches produce a silent no-op at runtime so a script
written against the full surface degrades gracefully on a minimal
adapter.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 adapter-kit PR.
