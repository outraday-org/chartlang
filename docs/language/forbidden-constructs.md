# Forbidden constructs

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §5.

The list of TypeScript features the chartlang compiler rejects:
runtime imports, dynamic `import()`, global side effects, `Math.random`
without a declared capability, network I/O, and any construct that
would break determinism or sandbox isolation. Each entry names the
compile-time analysis that catches it.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 compiler PR.
