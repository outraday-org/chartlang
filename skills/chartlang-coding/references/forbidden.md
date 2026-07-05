# Forbidden constructs

The chartlang compiler rejects every TypeScript construct that would
break the determinism, sandbox, or replay contract. There is **no
escape hatch in `apiVersion: 1`** — every restriction holds for every
v1 script.

The normative source for this list is
[grammar § Forbidden constructs](https://docs.chartlang.invinite.com/spec/grammar#forbidden-constructs).
This reference groups the constructs by *why* they are forbidden, so
you can route a user's error to the right rule without scanning a
diagnostic-code table.

## Determinism — no nondeterministic globals

A chartlang script must produce the same emissions for the same candle
stream every run. That rules out wall-clock and entropy sources.

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| `Date`, `Date.now()`, `new Date()` | `hostile-global` | `bar.time` (UTC ms at the bar boundary). |
| `Math.random()` | `hostile-global` | Not supported. Derive variation from price/volume series. |
| `performance.now()` | `hostile-global` | `bar.time`. |

```ts
// hostile-global — forbidden
const now = Date.now();
const r = Math.random();
```

## Sandbox I/O — no network or arbitrary code

`fetch` and dynamic `import()` would let a script reach outside its
sandbox to load arbitrary code or contact the network. The runtime
would not honour returned data even if those calls succeeded.

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| `fetch(...)` | `hostile-global` | Adapter-supplied feeds via `input.externalSeries`. |
| Dynamic `import(...)` | `hostile-global` | Static `import` from `@invinite-org/chartlang-core` only. |
| `require(...)` | `hostile-global` | Static `import`. |
| `eval(...)`, `new Function(...)` | `hostile-global` | Plain TypeScript expressions. |

## Non-replayable control flow

Wall-clock-driven timers and microtask schedulers make a script's
emissions order-dependent on the host's event loop, so they break
replay.

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| `setTimeout`, `setInterval` | `hostile-global` | Bar-driven: act on the current `compute` step. |
| `queueMicrotask` | `hostile-global` | Same — there is no async surface in a chartlang script. |
| `Promise`, `async`/`await` | `hostile-global` | `compute` is synchronous; everything resolves in-line. |
| `requestAnimationFrame` | `hostile-global` | The host drives the bar loop. |

## Bounded execution — no unbounded loops

Every loop must have literal numeric bounds the compiler can read
statically:

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

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| `while`, `do…while` | `unbounded-loop` | A literal-bounded `for`. |
| `for…of`, `for…in` | `unbounded-loop` | A literal-bounded `for` indexing the array. |
| `for (...; i < someInput; ...)` | `unbounded-loop` | A literal bound; if you need user-tuned iteration, cap with `Math.min(inputs.n, 200)` and loop to the literal cap. |

The allowed shape is `for (let i = <literal>; i </<= <literal>; i++)`
(or `>` / `>=`). Both bound and step must be literal-derivable.

## Literal-index rule extends to `bar.point`

A literal negative offset in `bar.point(<offset>, price)` sizes the
lookback buffer exactly like `series[n]`: `bar.point(-10, price)` retains
10 bars of history, just as `series[10]` does. A **dynamic / non-literal**
offset (`bar.point(-i, price)`) does *not* grow the buffer, so it reads a
`NaN` time once it reaches past the retained window — it never throws.
Keep the offset literal whenever you depend on a real historical time.

**Index anchoring vs. an absolute-time `WorldPoint`.** Both feed the same
`draw.*` anchor argument; pick by what you actually know:

- Reach for `bar.point(offset, price)` when the anchor is **relative to the
  current bar** — "10 bars ago", "5 bars ahead". The offset is the natural
  unit and the time is resolved (or extrapolated) for you.
- Pass a literal `WorldPoint { time, price }` when you have an **absolute
  timestamp** (a session boundary, an event time from an input). Do not
  reverse-engineer a bar offset from a known timestamp — anchor it directly.

## Stateful slot identity — no stateful calls inside loops

Every `ta.*`, `state.*`, `plot`, `alert`, `draw.*`, and `hline` callsite
owns one runtime slot keyed by `<sourcePath>:<line>:<col>#0`. Calling
the same primitive inside a loop body would map every iteration to the
same slot and silently merge their state.

```ts
// stateful-call-inside-loop — forbidden
// for (let i = 0; i < 5; i++) {
//     plot(bar.close + i, { title: `c+${i}` });
// }

// allowed — distinct call sites
plot(bar.close + 1, { title: "c+1" });
plot(bar.close + 2, { title: "c+2" });
```

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| Stateful call inside any loop body | `stateful-call-inside-loop` | Move the call to module / `compute`-top level; unroll if you need N copies. |
| `ta["ema"](...)` (element access) | `stateful-call-element-access` | `ta.ema(...)` — the compiler needs the property name in the AST to inject the slot id. |

## No recursion

A function that calls itself (directly or via mutual recursion) is
rejected with `recursion-not-allowed`. chartlang scripts are flat —
share helpers as plain functions called once per `compute` step.

## Source-form rules

| Forbidden | Diagnostic | Use instead |
|---|---|---|
| Missing default export | `missing-default-export` | `export default defineIndicator({ ... });` |
| Default export is not one of the four constructors | `missing-default-export` | One of `defineIndicator`, `defineDrawing`, `defineAlert`, `defineAlertCondition`. |
| `apiVersion` not the numeric literal `1` | `api-version-mismatch` | `apiVersion: 1`. |
| Non-literal `name` | `api-version-mismatch` (and similar) | A string literal. |
| Non-literal input default | `input-default-not-literal` | A literal value the compiler can read at compile time. |
| Two `input.interval` declarations | `multiple-input-interval` | A single `input.interval` — the user-pickable main timeframe. |

## Why a strict subset

Every restriction is the smallest one that keeps the determinism
contract. Once a script compiles, the runtime can guarantee
byte-identical emissions for byte-identical input, the sandbox does
not need to police the script at runtime (the rejected constructs
cannot reach it), and a persistent state snapshot can be replayed
across runs and across hosts because no script can read a clock or a
network.

## Cross-links

- The normative diagnostic table:
  [grammar § Forbidden constructs](https://docs.chartlang.invinite.com/spec/grammar#forbidden-constructs).
- The narrative rationale: `docs/language/forbidden-constructs.md`
  in the chartlang repo.
- The determinism contract:
  [Execution semantics § Determinism](https://docs.chartlang.invinite.com/spec/semantics#determinism).
