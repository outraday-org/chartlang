# Writing a host

> **Phase:** Lands in Phase 5+.
> **Cross-reference:** See PLAN.md §8.

Guide for embedding chartlang in a new sandbox environment: implement
the `ScriptHost` interface, satisfy the `structuredClone`-safe
emission contract, enforce determinism guarantees, and validate
against the host-author conformance scenarios.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands once the second host (QuickJS) proves the
abstraction in Phase 5.
