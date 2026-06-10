# Forbidden constructs

The compiler rejects every TypeScript construct that would break the
chartlang determinism, sandbox, or replay contract. The complete
diagnostic table — every code, every wording — is in
[grammar § forbidden constructs](../spec/grammar.md#forbidden-constructs).
This page explains why the categories exist and shows the most common
rejections.

## Determinism: no nondeterministic globals

A chartlang script must produce the same emissions for the same candle
stream every time it runs. That rules out wall-clock and entropy
sources.

```ts
// hostile-global — forbidden
const now = Date.now();
const r = Math.random();
```

The compiler flags `Date`, `Math.random`, `fetch`, `setTimeout`,
`setInterval`, `queueMicrotask`, `Promise`, `requestAnimationFrame`,
`eval`, `new Function(...)`, `require(...)`, and dynamic `import(...)`
with the diagnostic code `hostile-global`. There is no escape hatch in
`apiVersion: 1`. Time comes from the bar (`bar.time`), not the clock;
randomness is not supported.

## Sandboxing: no host I/O

`fetch` and dynamic `import()` would let a script reach outside its
sandbox to load arbitrary code or contact the network. They are
forbidden — chartlang scripts run inside a Worker (`host-worker`) or a
QuickJS membrane (`host-quickjs`), and the runtime would not honour the
returned data even if those calls succeeded.

## Bounded execution: no unbounded loops

Every loop must have literal numeric bounds:

```ts
// allowed — literal bounds, increments the loop variable
for (let i = 0; i < 10; i++) {
    void i;
}

// unbounded-loop — forbidden
// while (true) { ... }
// for (const x of someArray) { ... }
// for (let i = 0; i < someInput; i++) { ... }
```

`while`, `do…while`, `for…of`, and `for…in` are all forbidden. The
allowed shape is `for (let i = <literal>; i </<= <literal>; i++)` (or
the same with `>`/`>=`). The bound must be a numeric literal — the
compiler reads it statically.

## Stateful slot identity: no stateful calls inside loops

Each `ta.*` / `state.*` / `plot` / `alert` / `draw.*` callsite owns one
runtime slot keyed by `<sourcePath>:<line>:<col>#0`. Calling the same
primitive inside a loop body would map every iteration to the same slot
and silently merge their state. The diagnostic is
`stateful-call-inside-loop`.

```ts
// stateful-call-inside-loop — forbidden
// for (let i = 0; i < 5; i++) {
//     plot(bar.close + i, { title: `c+${i}` });
// }
```

Move the stateful call to module / `compute`-top level. The same applies
to element-access calls on stateful namespaces (`ta["ema"](...)` is
rejected with `stateful-call-element-access`), because the compiler
needs the property name at the AST level to inject the slot id.

## No recursion

A function that calls itself is rejected with `recursion-not-allowed`.
chartlang scripts are flat; share helpers as plain functions called
once per compute step.

## Source structure

The
[grammar source-form rules](../spec/grammar.md#source-form) cover the
script structure — one default export, exactly one of the four
constructors, the first argument an object literal with literal
`name: string` and `apiVersion: 1`. Violations fire
`missing-default-export` or `api-version-mismatch`.

## Why a strict subset

Every restriction here is the smallest one that keeps the determinism
contract. Once a script compiles, the runtime can guarantee:

- Byte-identical emissions for byte-identical input.
- The sandbox does not need to police the script at runtime — the
  rejected constructs cannot reach it.
- A persistent state snapshot can be replayed across runs and across
  hosts because no script can read a clock or a network.

## Cross-links

- The full diagnostic table: [grammar § forbidden constructs](../spec/grammar.md#forbidden-constructs).
- The static analyses that produce each diagnostic:
  [grammar § Static analyses](../spec/grammar.md#static-analyses).
- The determinism contract: [Execution semantics § Determinism](../spec/semantics.md#determinism).
