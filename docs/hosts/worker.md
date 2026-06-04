# Worker host

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §8.2.

`@invinite-org/chartlang-host-worker`, the browser-default sandbox host:
loads a compiled `.chart.js` artifact into a Web Worker, exposes the
`ScriptHost` interface, and ferries Plot / Draw / Alert emissions back
to the main thread via `postMessage` with `structuredClone`-safe
payloads.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 host-worker PR.
