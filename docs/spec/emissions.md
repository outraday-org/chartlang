# Emission payloads

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §7.

The canonical wire schemas for every Plot / Draw / Alert payload
crossing the adapter boundary. Each schema is JSON-friendly and
`structuredClone`-safe so the same bytes move through a Worker
`postMessage` or a QuickJS-WASM membrane unchanged.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 adapter-kit PR.
