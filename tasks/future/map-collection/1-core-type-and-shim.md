# Task 1 — Core `MutableMapSlot` + `state.map` hole + registry + ambient shim + capacity guard

> **Status: TODO**

## Goal

Introduce `MutableMapSlot<K, V>` in core, add the `state.map<K, V>(capacity)`
sentinel hole on the `state` namespace, append `{ name: "state.map", slot: true }`
to `STATEFUL_PRIMITIVES`, mirror it in the compiler ambient shim, extend the
existing literal-capacity compiler guard to cover `state.map`, and add
type-level tests + the feature changeset.

## Prerequisites

- `../state-array/` tasks 1 + 3 landed (handle pattern + literal-capacity
  guard).

## Current Behavior

- `state` (`packages/core/src/state/state.ts:25`) is a frozen object of
  sentinel holes (`float`/`int`/`bool`/`string`/`tick`, plus `array`/`series`
  from the future tasks). `sentinel(name)` (line 6) throws when called outside
  a step.
- `MutableArraySlot<T>` (`packages/core/src/state/arraySlot.ts`) is the
  non-coercible collection-handle precedent.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`,
  `STATEFUL_PRIMITIVE_ENTRIES`) lists `state.*` entries as `{ slot: true }`.
- The compiler ambient shim (`packages/compiler/src/program.ts`) declares
  `StateNamespace` mirroring core, and a capacity-guard pass (from state-array
  task 3) asserts `state.array(N)`'s `N` is a numeric literal.

## Desired Behavior

```ts
const m = state.map<number, number>(50);
m.set(10, 1);                 // void
const v = m.get(10);          // number | undefined
m.has(10);                    // boolean
m.delete(10);                 // boolean
m.size;                       // number
for (const k of m.keys()) {}  // IterableIterator<number>
m.clear();
// +m / m === 5 do NOT type-check (non-coercible handle)
state.map<number, number>(n); // COMPILE ERROR if n is not a numeric literal
```

## Requirements

### 1. New core type (`packages/core/src/state/mapSlot.ts`, new)

Two-line MIT header + JSDoc in the `arraySlot.ts` style:

```ts
/**
 * Script-facing handle on a persistent, bounded **keyed collection** —
 * Pine's `map<K, V>` with capacity eviction. Persists across bars with
 * `state.*` committed/tentative semantics. `set` inserts/updates; inserting a
 * NEW key at capacity evicts the oldest-inserted key; `get` returns
 * `undefined` for an absent key (distinct from a stored `0`). Keys are
 * `string | number` (deterministically hashable + snapshot-cloneable); v1
 * value type is `number`. Not number-coercible — it is a collection.
 *
 * @since 1.2
 * @stable
 * @example
 *     function bump(m: MutableMapSlot<number, number>, k: number): void {
 *         m.set(k, (m.get(k) ?? 0) + 1);
 *     }
 */
export type MutableMapSlot<K extends string | number, V> = {
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    readonly size: number;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[K, V]>;
};
```

Re-export `MutableMapSlot` from `packages/core/src/index.ts` next to
`MutableArraySlot`.

> **`for...of` note:** scripts iterating `m.keys()` use `for...of`, which the
> forbidden-constructs pass rejects as `unbounded-loop`
> (`packages/compiler/src/analysis/forbiddenConstructs.ts`). The store is
> capacity-bounded, so iteration is finite — but the compiler can't see that.
> **Resolve this in this task:** either (a) document that `keys()`/`values()`/
> `entries()` are reachable only via `array`-style bounded indexing helpers
> (drop the iterators from v1 and expose `keyAt(i)`/`size`), or (b) special-case
> `for...of` over a `state.map` iterator in the loop-bounds analysis
> (`parseBoundedForLoop`) since capacity bounds it. **Recommended: option (a)
> for v1** — expose `keyAt(index: number): K | undefined` + `size` and defer
> iterators — it needs no compiler-analysis change. Update the type above
> accordingly and note iterators as deferred.

### 2. `state.map` hole (`packages/core/src/state/state.ts`)

Add to the frozen `state` object (next to `array`), generic over `K, V`,
returning a `sentinel("state.map")`-backed `MutableMapSlot<K, V>`. JSDoc with
`@since 1.2`, `@stable`, `@example`. The `capacity` param is typed `number`
(the literal constraint is enforced by the compiler guard, not the type).

### 3. Registry (`packages/core/src/statefulPrimitives.ts`)

Append `{ name: "state.map", slot: true }` to `STATEFUL_PRIMITIVE_ENTRIES`
(keeps `STATEFUL_PRIMITIVES_BY_NAME` derivation correct). Update any
count-based test asserting the registry length.

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Add `MutableMapSlot` to the shim and the `map<K, V>(capacity)` method to the
shim's `StateNamespace` (mirror core exactly — keyAt/size form per the option-a
decision).

### 5. Extend the literal-capacity guard

In the compiler pass from `../state-array/` task 3, add `"state.map"` to the
set of primitive names whose first argument must be a compile-time numeric
literal. Add a guard unit test: `state.map<number, number>(n)` with a
non-literal `n` produces the same diagnostic code as the `state.array` case.

### 6. Type tests (`packages/core/src/state/mapSlot.types.test.ts`)

Assert: `m.get(k)` is `number | undefined`; `m.has(k)` is `boolean`; `+m` does
**not** type-check (`@ts-expect-error`); a non-`string|number` key is rejected.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/mapSlot.ts` | Create | `MutableMapSlot<K, V>`. |
| `packages/core/src/state/state.ts` | Modify | `state.map` hole. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Registry entry. |
| `packages/core/src/state/mapSlot.types.test.ts` | Create | Type assertions. |
| `packages/core/src/index.ts` | Modify | Barrel export `MutableMapSlot`. |
| `packages/compiler/src/program.ts` | Modify | Shim `MutableMapSlot` + `state.map`. |
| `packages/compiler/src/<capacity-guard pass>.ts` | Modify | Add `state.map` to guarded names. |
| `packages/compiler/src/<capacity-guard>.test.ts` | Modify | Guard test for `state.map`. |
| `.changeset/state-map-core.md` | Create | minor (core, compiler). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core + compiler)
- `pnpm docs:check`

## Changeset

`.changeset/state-map-core.md` — **minor** (core, compiler).

## Acceptance Criteria

- `state.map<number, number>(50)` type-checks; `+m` rejected; non-literal
  capacity rejected with the shared guard diagnostic.
- Registry + ambient shim mirror core; a compile fixture using `state.map`
  compiles clean.
- v1 has no iterator constructs requiring loop-analysis changes (option-a
  `keyAt`/`size`); iterators documented as deferred.
- Type + guard tests pass; 100% coverage; JSDoc gate green; changeset committed.
