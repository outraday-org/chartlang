# RFC 0002 — The `order.*` namespace and the `orders` emission channel

- **Status:** Accepted (decided by owner 2026-08-17)
- **Author:** chartlang maintainers
- **Created:** 2026-08-17
- **Scope:** language surface (`order.*`), manifest capability derivation,
  adapter wire contract (`RunnerEmissions.orders`, `Capabilities.orders`),
  runtime slot lifecycle + snapshot, hosts, conformance, generated docs /
  hover / skills surfaces, examples, demo apps, Pine converter
- **Supersedes:** the two recorded deferrals of strategy primitives —
  `docs/spec/pine-migration.md:379-384` ("Strategy primitives are Beyond 1.0
  and require a future `Capabilities.strategy` flag") and
  `tasks/old/pine-parity-additions/README.md:164-166` ("Strategy /
  backtesting … Large; likely `apiVersion` scope decision. Out of scope.")
- **Informs:** `tasks/future/trading-chart-ai-overhaul/chartlang-backtest/`

> All code sketches in this RFC are **normative for the implementation
> tasks** (the shape was accepted, not merely proposed) but no code ships
> with this document; it changes no package, type, or test.

> **Errata (2026-08-18).** Implementing this RFC found three *factual* claims
> in §6, §9 and §11 to be wrong, and one instruction in §6 that contradicts §5.
> The decisions they sit beside were correct and are unchanged; the corrections
> are recorded, dated, in the Errata section at the end of this document rather
> than by editing the accepted text.

---

## 0. Decision summary (read this first)

**Accepted:** chartlang gains a first-class `order.*` namespace inside
`defineIndicator`, carried on a new append-only `orders` emission channel,
gated by a new `Capabilities.orders` boolean, with the runtime tracking a
*nominal* position and auto-rendering entry/exit arrows through the plot
pipeline that already exists. Fill economics stay in the consumer.

Why now: the current answer to "how does a consumer read a strategy signal
out of chartlang?" is **parse the alert message**. The Pine converter lowers
`strategy.entry` / `exit` / `close` / `order` to
`alert("<id> <member>", { severity: "info" })`
(`packages/pine-converter/src/transform/strategySignals.ts:101-113`) with a
`strategy-signal-only` diagnostic, and downstream consumers recover the
direction from a prefix. That convention is prose, not a contract, and §1
measures what it costs.

The five accepted decisions, each argued in the section named:

1. **A new emission channel, not a payload convention** (§3, §6).
   `RunnerEmissions` is a fixed six-channel envelope
   (`packages/adapter-kit/src/types.ts:941-950`) and Phase 5 already set the
   precedent for growing it additively — its own doc comment records that
   release "additively adds `alertConditions` + `logs`" (`:925`). `orders`
   is the third additive channel, not a new mechanism.
2. **`order.*` lives inside `defineIndicator`; there is no fifth script
   kind** (§3). The capability is derived from callsites exactly as `alert`
   derives `alerts` (`packages/compiler/src/analysis/extractCapabilities.ts:48-54`).
3. **v1 is market orders plus readable position state** (§4, §5).
   `order.buy` / `order.sell` / `order.close` / `order.position()`. No limit,
   stop, or bracket orders — those drag a fill model into the language.
4. **The runtime auto-renders arrows** (§5, §8). Each accepted order on a
   confirmed step additionally emits an `arrow`-style plot
   (`packages/adapter-kit/src/types.ts:469`) and, when labelled, a `label`
   plot (`:435`). All six bundled adapters already render both, so every
   consumer gets markers with **zero** adapter code. Per-call
   `marker: false` opts out.
5. **chartlang tracks a *nominal* position only** (§7). Orders fold at the end
   of confirmed steps at the signal bar's close. Next-bar-open fills,
   slippage, commission, and equity are the consumer's job, and the
   divergence is documented rather than hidden.

**What this reverses.** `pine-migration.md:379-384` says strategy primitives
are Beyond 1.0 and would need a future `Capabilities.strategy` flag. Both
halves change: they land in 1.x, and the shipped mechanism is
`Capabilities.orders`, not `Capabilities.strategy`. §13 records the reversal;
`docs/spec/pine-migration.md` is rewritten by the docs task, not here.

**What this is not.** Not an economic backtester (§3, rejected option D). Not
a new script kind (§3, rejected option C). Not an `apiVersion: 2` change: the
whole feature is additive within `apiVersion: 1` under three existing rules —
new core exports (`docs/spec/versioning.md:52-55`), new
`STATEFUL_PRIMITIVES` entries (`:72-75`), and new emission wire fields
(`:105-115`).

---

## 1. Problem statement & motivation

### The signal is unstructured today

A chartlang script that wants to say "go long here" has exactly one door:
`alert()`. `AlertEmission` carries `severity`, `message`, `meta`, and a
`dedupeKey` (`packages/adapter-kit/src/types.ts:696-706`) — nothing that
names an action or a direction. So the *direction lives in the prose*, and
every consumer re-derives it:

- The Pine converter emits `alert("<id> <member>", { severity: "info" })`
  (`strategySignals.ts:113`) with the `strategy-signal-only` diagnostic
  (`:109`) telling the author to "wire the alert into your own execution
  layer".
- A backtesting consumer then classifies by prefix. The motivating consumer
  (invinite's Strategy Backtest v0) matches `buy|long|entry` against
  `sell|short|exit|close` and falls back to strict alternation when neither
  matches.

**Measured failure rate: 6 of 6.** Against that consumer's own 234-template
catalogue, all six alert-emitting templates misclassify. Three open with
`"Close crossed…"` — the literal substring `close` reads as an *exit* prefix,
so the strategy is exit-only and books zero trades. The other three match no
prefix at all and fall into arbitrary alternation, where the first signal is
an entry because it happens to be first.

That is not a tuning problem. Any prefix table is a guess about English, and
the language handed the consumer nothing better to guess from.

### What a structured channel has to carry

Three facts, none of which survive a string:

1. **Action** — open long / open short / go flat, as an enum the consumer
   switches on.
2. **Bar index** — consumers currently round-trip through timestamps to
   recover the bar a signal belongs to. Every emission channel already
   carries `bar` (`AlertEmission.bar`, `types.ts:701`); orders inherit it.
3. **Position context** — a script that wants "close only if long" must be
   able to *read* its own position. There is no such read today, so scripts
   hand-roll a `state.bool` flag whose semantics silently diverge from
   whatever the consumer simulates.

### What is deliberately still missing after v1

Limit and stop orders, SL/TP brackets, and position sizing that a simulator
honours. Each of those forces the language to define *when a resting order
fills*, which is a fill model, which is the thing §3 rejects putting in the
runtime. They are additive later within `apiVersion: 1` (§11).

---

## 2. Survey of the Pine model

Pine v6's strategy surface, and the parts worth matching:

| Pine | Meaning | v1 verdict |
|---|---|---|
| `strategy(...)` declaration header | Turns a script into a backtestable strategy; carries `initial_capital`, `commission_*`, `slippage`, `default_qty_*`, `pyramiding`, `margin_*` | **Not matched.** Every field is an *economic* parameter. Recognised and dropped with a diagnostic (§9). |
| `strategy.entry(id, direction, qty?)` | Market entry, reversing an opposite position | **Matched** → `order.buy` / `order.sell` |
| `strategy.order(id, direction, qty?)` | Raw order without reversal semantics | **Matched** → `order.buy` / `order.sell` (the reversal difference is a fill-model nuance a nominal tracker cannot express) |
| `strategy.close(id)` / `strategy.close_all()` | Flatten a named entry / everything | **Matched** → `order.close` |
| `strategy.exit(id, from, stop, limit, trail_*)` | Bracketed exit | **Partially matched** → `order.close`; the stop / limit / trail arguments are dropped with a diagnostic |
| `strategy.long` / `strategy.short` | Direction constants | **Matched** as callsite-resolved intrinsics (§9) |
| `strategy.position_size` | Signed position, updated **after** the bar that fills | **Matched** → `order.position().size`, with the same one-fold lag (§7) |
| `strategy.position_avg_price` | Average entry price | **Matched** → `order.position().avgPrice`, at *nominal* prices |
| `strategy.equity`, `strategy.netprofit`, `strategy.opentrades.*`, the Strategy Tester report | Simulated economics | **Not matched.** Consumer-owned (§3 option D). |

Two Pine behaviours are worth calling out because matching them is what makes
the surface feel familiar rather than merely present:

- **`strategy.position_size` lags by one fill.** Pine evaluates a bar's
  script, *then* fills; a read inside the same bar sees the pre-order
  position. §7 reproduces this exactly, and it falls out of folding at
  step end rather than needing a special case.
- **Direction is a first-class enum, not a sign convention.** Pine spells the
  side (`strategy.long`), then lets `qty` be positive. `order.buy` /
  `order.sell` keep that: the action names the intent, `qty` is unsigned
  magnitude, and only the *tracked position* is signed.

---

## 3. Options analysis

Five options were considered. **Option B is accepted**; the other four are
recorded with the reason each was rejected, per `docs/rfcs/README.md:8-10`.

### Option A — an `AlertEmission.meta` payload convention

Keep one channel. Publish a convention: an order is an alert whose
`meta` carries `{ action: "buy", qty: 1 }`.

**Rejected.** It is the defect being fixed, one layer up. `meta` is
`Readonly<Record<string, JsonValue>>` (`types.ts:703`) — untyped by
construction, unvalidated by `validateEmission`, invisible to
`Capabilities`, and indistinguishable at the adapter from any other alert.
A consumer would still be guessing, just about key names instead of English
prefixes, and nothing in the toolchain could tell it it guessed wrong. It
also inherits alert dedup: alerts collapse per `(slotId, bar)`
last-write-wins (`docs/spec/semantics.md:389-390`), so a loop issuing two
orders at one callsite in one bar would silently keep one — see the
append-only argument in §6.

### Option B — a first-class `orders` channel (**accepted**)

A new `order.*` namespace inside `defineIndicator`, a new
`RunnerEmissions.orders` array of typed `OrderEmission`s, a new
`Capabilities.orders` boolean, an `orders` `CapabilityId` derived from
callsites.

**Accepted.** It is the *smallest* option that makes the signal typed
end to end, and every layer it needs already has a precedent to copy rather
than a mechanism to invent (§5, §6, §12).

### Option C — a new `defineStrategy` script kind

Model strategies as a fifth script kind beside `defineIndicator`,
`defineDrawing`, `defineAlert`, `defineAlertCondition`.

**Rejected, twice over.**

1. *Cost.* The kind union appears as a literal in eight-plus compiler sites —
   `analysis/extractCapabilities.ts:33-44`, `manifest.ts:40`, `api.ts:417`,
   `program.ts:1325`, and five arms of `analysis/structuralChecks.ts` — plus
   the docs, the skills, and the conformance inventory. A fifth arm is a
   wide, mechanical, high-regret change.
2. *It would be a duplicate.* A strategy still wants to plot its moving
   averages, draw its levels, and log. `defineStrategy` would therefore be
   `defineIndicator` plus `order.*`, which is what `defineIndicator` plus
   `order.*` already is. Pine itself is the counter-example, not the
   precedent: `strategy()` and `indicator()` differ by their *header* and by
   the Strategy Tester, both of which are economics — and economics are
   consumer-side here (option D).

The accepted alternative — derive the capability from callsites — needs no
kind: `extractCapabilities` already special-cases the callee name `"alert"`
(`extractCapabilities.ts:51-52`) and `SEED_BY_KIND` (`:37-44`) stays
untouched because no kind seeds `orders`.

### Option D — an in-runtime economic backtester

Have the runtime simulate fills, apply slippage and commission, and emit an
equity curve and a performance report.

**Rejected for v1** — and `tasks/old/pine-parity-additions/README.md:164-166`
already predicted why, calling it "large; likely `apiVersion` scope
decision". Three reasons stand:

- **It picks a fill policy for everybody.** Next-bar-open? Same-bar close?
  Intrabar with a tick stream? A consumer that disagrees cannot opt out of a
  number the language computed, and every consumer disagrees about at least
  slippage.
- **It is not determinism-neutral.** Equity depends on capital, sizing, and
  fees — none of which are chart data, all of which would have to enter the
  language as inputs and then ride every snapshot.
- **The consumer already has one.** The motivating consumer owns a pure,
  tested fill simulator with next-bar-open fills, slippage, and commission.
  It does not need a second, differently-opinionated one upstream; it needs a
  trustworthy *signal*, which is option B.

`order.position()` is deliberately *not* a crack in this wall: it is nominal
bookkeeping over the emitted intents (signed size, an average of nominal
prices, an entry bar), with no capital, no fees, and no P&L. §7 states the
divergence as a contract.

### Option E — lower `order.*` to draw / plot emissions with no channel

Let `order.buy()` be sugar that emits an arrow marker and nothing else.

**Rejected.** It inverts the fix: consumers would parse *visuals* instead of
prose, which is strictly worse — a plot emission carries a value and a style,
not an action. It also has no capability gate, so a headless server host
would receive markers it cannot use and could not decline; and pushing text
through `label` drawings pressures the drawing budget
(`types.ts:374` `maxDrawingsPerScript`, enforced per family) for what is
signal, not decoration.

The accepted design keeps the *visual* half of this option — auto-rendered
arrows are genuinely valuable and free (§5) — while making the channel the
source of truth. Markers are a courtesy; that asymmetry is what lets them be
silently skipped when an adapter cannot draw them.

### Comparison

| Axis | A — alert `meta` | **B — channel (accepted)** | C — new kind | D — backtester | E — visuals only |
|---|---|---|---|---|---|
| Consumer reads a typed action | No | **Yes** | Yes | Yes | No |
| Validated on the wire | No | **Yes** (`validateEmission` arm) | Yes | Yes | Partly |
| Capability-gateable | No | **Yes** (`Capabilities.orders`) | Yes | Yes | No |
| Survives a loop emitting twice in one bar | No (LWW) | **Yes** (append-only) | Yes | Yes | No (plot LWW) |
| Compiler surface delta | None | **Two `CapabilityId` unions + one callee match** | 8+ kind sites | 8+ | None |
| Adapter migration | None | **None** (new optional read; markers ride plots) | None | None | None |
| Language owns a fill policy | No | **No** | No | **Yes** | No |
| Net new surface | Smallest | **Small** | Large | Largest | Smallest |

---

## 4. Recommendation

Adopt **Option B**, scoped as follows.

**In v1:**

- `order.buy(opts?)`, `order.sell(opts?)`, `order.close(opts?)` — market
  intents.
- `order.position()` — a read of the nominal position (signed size, nominal
  average price, entry bar).
- `orders` as a `CapabilityId` (manifest, callsite-derived) **and** as a
  `Capabilities.orders` boolean (adapter).
- `OrderEmission` on an append-only `RunnerEmissions.orders`.
- Runtime-emitted `arrow` (+ optional `label`) plots per accepted order.
- Position state in the snapshot round-trip.
- Pine `strategy.entry` / `order` / `close` / `close_all` / `exit` lowering
  to `order.*`.

**Deliberately deferred** (each additive within `apiVersion: 1` later):

- Limit / stop / bracket orders, and any resting-order lifecycle.
- Economic simulation of any kind: fills, slippage, commission, equity,
  performance reports.
- `qty` *economics*. `qty` is carried on the wire and surfaced to consumers
  from day one; the nominal tracker treats an absent `qty` as one unit and
  ignores `qty` on `close` (full flat). A consumer may honour it fully.
- A set-of-kinds `Capabilities.orders` (see §6 on why a boolean is right for
  a market-only v1).
- Trade-narrative visualisation primitives (`PHASE_5_DEFERRED` keeps
  `ta.tradeEquityCurve` and kin deferred — `order.*` is not in that set).
- Server-side order consumption in the motivating consumer: its alert
  reconciliation and finder evaluation stay `orders: false` and ignore the
  channel, exactly as they already ignore drawings.

---

## 5. API sketch (accepted option)

> Normative in shape; exact JSDoc wording is an implementation-task
> decision.

### Script-facing surface

```ts
// packages/core/src/order/order.ts — new, modelled on the alert hole
// (packages/core/src/alert/alert.ts:36-38).

export type OrderAction = "buy" | "sell" | "close";

export type OrderOpts = Readonly<{
    qty?: number;                               // units; absent = consumer default
    label?: string;                             // shown on the auto-marker and to consumers
    marker?: boolean;                           // default true — auto-arrow opt-out
    meta?: Readonly<Record<string, JsonValue>>; // structured payload for consumers
}>;

export type OrderPosition = Readonly<{
    size: number;             // signed: > 0 long, < 0 short, 0 flat
    avgPrice: number | null;  // null when flat; nominal — signal-bar close
    entryBar: number | null;  // bar index the current position opened
}>;

export type OrderNamespace = Readonly<{
    buy(opts?: OrderOpts): void;
    sell(opts?: OrderOpts): void;
    close(opts?: OrderOpts): void;
    position(): OrderPosition;
}>;
```

`order` is a frozen namespace object like `draw`, not a bare function like
`alert`, so the compiler's slot injection reaches it as a dotted name.
Reachable two ways, matching every other primitive namespace: as a core
import, and destructured off `ComputeContext` (`compute({ order })`).

**Legal contexts.** `order.*` is legal wherever `alert` is: inside
`defineIndicator`'s `compute`, and inside the `compute` of `defineAlert` /
`defineDrawing`. There is no new script kind and no kind seeds the
capability.

### Registration

`packages/core/src/statefulPrimitives.ts` gains four entries beside
`{ name: "alert", slot: true }` (`:132`):

```ts
{ name: "order.buy",      slot: true  },
{ name: "order.sell",     slot: true  },
{ name: "order.close",    slot: true  },
{ name: "order.position", slot: false },
```

The three emitters are `slot: true` because each callsite needs a stable id
for its emissions, its once-per-slot diagnostic, and its synthetic marker
slots. `order.position` is `slot: false` — it is a pure read and allocates
nothing, which also keeps it legal inside bounded loops.

> **Do not restate a total.** The registry census measured while authoring
> this RFC is **202 entries / 186 `slot: true` / 16 `slot: false`**, and
> three JSDoc mentions in that file are *already* stale against it. The
> normative statement is the **+4 delta** (+3 slot-true, +1 slot-false); the
> implementation task re-counts from source and fixes the stale prose in the
> same edit. A hardcoded total in this RFC would be a fourth stale number.

### Capability derivation

`packages/compiler/src/analysis/extractCapabilities.ts:48-54` walks call
expressions and adds `"alerts"` when the resolved callee name is `"alert"`.
Add the same hook for the three emitter names:

```
resolveCalleeName(node) ∈ { "order.buy", "order.sell", "order.close" }  ⇒  add "orders"
resolveCalleeName(node) === "order.position"                            ⇒  add nothing
```

`order.position()` is read-only, so a script that merely inspects its
position does not ask the adapter for a capability it never uses.

### Auto-markers

Each accepted order on a confirmed step (§7) additionally emits through the
internal plot seam (`packages/runtime/src/emit/plot.ts:161`, **not** the
public `plot()` author hole, so slot bookkeeping stays explicit):

| | Arrow | Label (only when `label !== ""`) |
|---|---|---|
| Style | `{ kind: "arrow", direction, size }` (`types.ts:469`) | `{ kind: "label", text, position }` (`types.ts:435`) |
| `direction` / `position` | `up` for `buy`; `down` for `sell` / `close` | `below` for `buy`; `above` for `sell` / `close` |
| Anchor value | `bar.low` for `buy`; `bar.high` for `sell` / `close` | same anchor |
| Colour | `#26a69a` (buy) / `#ef5350` (sell, close) | same |
| Slot id | `${slotId}#marker` | `${slotId}#label` |

Two plots rather than one because the `arrow` style carries no text field —
that is a property of the existing `PlotStyle` union, not a new design.

Three rules make the markers safe to be free:

- **Silently pre-gated** on `capabilities.plots.has("arrow")` (and
  `"label"`). No diagnostic. The `orders` channel is the source of truth;
  markers are a courtesy, and an adapter that cannot draw an arrow has not
  failed to honour a promise it made.
- **Per-call `marker: false`** suppresses them. `marker` is render-side only
  and is deliberately **absent from `OrderEmission`** — the wire records the
  intent, not how it was drawn.
- **No new kinds.** No new `PlotKind`, no new `DrawingKind`, no adapter
  change. The synthetic `#marker` / `#label` suffixes cannot collide with
  compiler-issued ids, which embed `:line:col#<n>`.

### The idiom this produces

```ts
compute({ bar, ta, order }) {
    const fast = ta.ema(bar.close, 12);
    const slow = ta.ema(bar.close, 26);
    if (order.position().size <= 0 && ta.crossover(fast, slow).current) {
        order.buy({ label: "Long" });
    }
    if (order.position().size > 0 && ta.crossunder(fast, slow).current) {
        order.close({ label: "Exit" });
    }
}
```

Compare the status quo: the same script with `alert("Long entry")` /
`alert("Close crossed under")`, and a consumer guessing.

---

## 6. Adapter contract impact

**Additive. No adapter migration for rendering; one required key on the
capability bag.**

### The channel

`RunnerEmissions` (`packages/adapter-kit/src/types.ts:941-950`) gains one
required field. Its own doc comment already records the growth pattern —
"Phase 1 ships … Phase 5 additively adds `alertConditions` + `logs`"
(`:925`) — and `orders` is the next line of that sentence.

```ts
export type OrderEmission = {
    readonly kind: "order";
    readonly slotId: string;      // compiler-injected callsite id
    readonly action: OrderAction; // re-exported from core, not redeclared
    readonly qty: number | null;  // null = unspecified; finite > 0 when present
    readonly label: string;       // "" when the author gave none
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly dedupeKey: string;   // ${slotId}::${bar}::FNV1a(action+qty+label+meta)
};
```

Every field is **required**. A brand-new type has no back-compat tail to
protect, and the retrofit-optional `alertConditions?` on the runtime's
mutable twin is the counter-example: it seeded `?? []` fallbacks across the
codebase that then had to be honest about a state that could not occur.
*Future* fields follow the omitted-when-absent optional-tail rule the file
already documents.

**Normative queue position: `orders` sits after `alertConditions` and before
`logs`** — signals grouped with signals, ahead of logs and diagnostics. This
is one decision with two homes, and they must move together:

- the field order in `RunnerEmissions`, and
- the normative eight-item list at `docs/spec/semantics.md:375-382`, where
  `orders` becomes item 5 and the list becomes nine.

TypeScript field order is not wire-breaking (these are objects, not tuples);
the reason to fix it is that the spec list, the type, and the conformance
`BufferedRun` (`packages/conformance/src/runConformanceSuite.ts:451-460`)
are read as one roster, and a roster that disagrees with itself is worse
than either order.

### Append-only, not last-write-wins

`docs/spec/semantics.md:389-392` records the existing dedup rules: plots and
alerts collapse per `(slotId, bar)` last-write-wins; drawings per
`(handleId, bar)`; alert-conditions and logs preserve append order. Orders
join the **append-order** group, matching `pushAlertCondition`
(`packages/runtime/src/emit/emissionsQueue.ts:96`) and `pushLog` (`:123`)
rather than `pushAlert` (`:63`).

The reason is specific to this channel, and it is a correctness argument, not
a taste one: replacement-dedup exists for *idempotent visuals*, where the
last state of a bar is the truth. An order is not a state, it is an event,
and the runtime's own position tracker (§7) folds **every** accepted order.
So a dropped duplicate would leave the emitted stream and the reported
position disagreeing — the exact class of bug this whole RFC is fixing, one
layer down. Host idempotency is served by `dedupeKey` instead, mirroring the
alert contract (`AlertEmission.dedupeKey`, `types.ts:705`).

### The capability, and a two-namespace asymmetry worth knowing

Add `readonly orders: boolean;` to `Capabilities`
(`packages/adapter-kit/src/types.ts:270-377`), matching the
`alertConditions` (`:284`) / `logs` (`:294`) boolean idiom. Market-only v1
has no subkinds to enumerate; if limit / stop orders ever land, a
set-of-kinds shape can supersede the boolean at `apiVersion: 2`.

`orders: false` ⇒ the runtime drops the call, pushes one
`unsupported-orders` diagnostic **once per slot per mount**, and emits no
auto-markers.

There are **two** capability namespaces in this codebase and they are not the
same set. Every implementation task that touches either needs this table:

| Key | `CapabilityId` (core, manifest-side) | `Capabilities` (adapter-side) |
|---|---|---|
| `indicators` | yes | — |
| `drawings` | yes | yes |
| `alerts` | yes | yes |
| `alertConditions` | yes | yes |
| `logs` | — | yes |
| **`orders`** | **yes (new)** | **yes (new)** |

`orders` is the first `CapabilityId` **no script kind seeds** — the four
existing arms (`packages/core/src/types.ts:468`) are exactly the four kind
seeds of `SEED_BY_KIND` (`extractCapabilities.ts:37-44`), and `alerts` is
additionally callsite-derived. `orders` is *only* callsite-derived. That is
why the manifest-side sweep is narrow and enumerable: core's union
(`types.ts:468`), the compiler's hand-maintained ambient mirror of it, and
the local union in `extractCapabilities.ts`. Nothing else enumerates
capability ids.

### What adapters must and must not do

- **Must:** add `orders` to their capability literal. This is a *compile
  error* on upgrade for any integrator with a hand-written `Capabilities`
  bag — a deliberate, enumerable break that the changeset must call out, and
  the same shape of break `multiSymbol` already caused.
- **Need not:** render anything. Auto-markers arrive as `arrow` / `label`
  plot emissions all six bundled adapters already draw.
- **May:** forward `emissions.orders` to an app-layer sink. The precedent to
  mirror is the existing optional `onAlert` factory option
  (`examples/canvas2d-adapter/src/createCanvas2dAdapter.ts:120`, forwarded at
  `:1232`); an `onOrder` sibling is what gives a demo or an embedding app a
  path to the array at all.
- **May:** decline. A headless server host declaring `orders: false` and
  ignoring the channel is a supported posture, exactly as it already ignores
  drawings.

### One piece of stale spec prose to fix while here

`docs/spec/emissions.md:326-329` and `:354` both state the capability bag has
"13 keys". It has **14** today — the sentence omits `multiSymbol`
(`types.ts:339`). With `orders` it is **15**. The docs task writes 15, not a
propagated 14.

---

## 7. Lifecycle & sandbox correctness

This is where the design has real invariants rather than plumbing, and where
a miss is silent data loss rather than an error.

### The fold rule

**Orders queue on any step; the position folds only at the end of a
*confirmed* step** (`history` or `close`).

- On a **`tick`** step, an order emits (the host receives it, exactly as it
  receives a tick's alerts) but the position **never moves**, and no markers
  are emitted. Ticks are replaced, not accumulated; a folding tick would
  double-apply the moment the head bar is re-ticked.
- On a **halted** step (`runtime.error()`), pending orders are **discarded**
  along with the visual queues. A halted bar's intents are not trustworthy,
  and this is the one place the "orders are signals, not visuals" framing
  does *not* buy them different treatment — the framing argues for surviving
  *dedup*, not for surviving a *halt*.
- `order.position()` therefore reads the state as of the **previous**
  confirmed fold. This reproduces Pine's `strategy.position_size` lag (§2)
  and needs no special case: reads happen during `compute`, folds happen
  after it returns.

### Fold arithmetic (nominal)

Nominal fill price is the folding step's `bar.close`. Absent `qty` is one
unit.

- `buy` q: `size += q`. Crossing from `<= 0` to `> 0` restarts `entryBar` and
  `avgPrice` at this bar / close. Adding to an existing long averages the
  nominal prices by size.
- `sell` q: symmetric on the negative side.
- `close`: `size = 0`, `avgPrice = null`, `entryBar = null`. v1's nominal
  tracker ignores a partial-close `qty` (the emission still carries it for
  consumers that simulate partials).
- A `buy` while short (or `sell` while long) that crosses zero **reverses**;
  `entryBar` and `avgPrice` restart at this bar / close.

### The divergence, stated rather than hidden

chartlang's position is *nominal*: it prices fills at the signal bar's close,
knows nothing of capital, and applies no slippage or commission. A consumer
that fills at the next bar's open — the typical, and the motivating
consumer's, policy — **will** report a different average price and a
different P&L than a naive read of `avgPrice` suggests.

That is intended. `order.position()` exists so a *script* can branch on its
own state deterministically; a consumer's simulator is the authority on
economics. The language docs say this in as many words, because a divergence
a reader discovers is a bug report and a divergence a reader is told about is
a contract.

### Snapshot / restore

Position state **must** ride `exportSnapshot` / `importSnapshot`
(`packages/runtime/src/createScriptRunner.ts:209` / `:229`, wired at `:847` /
`:850`). This is not hardening: the motivating consumer's server-side Symbol
Durable Object round-trips snapshots on eviction, so a lost position would
silently flip the direction of every subsequent signal — the failure would
look like a strategy that changed its mind, not like a lost field.

The codec is version-locked, not free-form: only `snapshotVersion: 2` is
accepted and v1 payloads are rejected outright
(`packages/runtime/src/persistentStateStore.validate.ts:63,89`). The
validator tolerates unknown top-level keys and has optional-additive
precedent (`siblings?`, `dependencies?`). Follow it: **keep version 2**, add
an **optional** position field, and treat absence as flat. A pre-orders
snapshot then stays loadable, and no version bump is spent on an additive
field.

### The two sites that will silently swallow orders

Both are enumerated here because both are load-bearing and neither errors
when missed:

1. **The history accumulator.** `onHistory` hoists each channel's array
   across the per-bar loop and pushes into it. A channel omitted there keeps
   only the **last bar's** entries — a 1000-bar backfill would report one
   order. The regression test to own this is explicit: three bars, orders on
   bar 0 and bar 2, drained `orders.length === 2`.
2. **The dep / sibling emission policy.**
   `packages/runtime/src/dep/emissionFilter.ts` resets every channel at
   `:67-74` and forwards from siblings at `:137-157`. Orders follow the
   **alert** side of that policy, not the drawing side:
   - **Private dep** (`kind: "dep"`) — **drop**. A data dependency must not
     trade through its consumer. Only diagnostics escape a private dep.
   - **Sibling** — **forward with the `export:<name>/` slot-id prefix**,
     exactly as alerts are prefixed (`:141-146`). `dedupeKey` is left as-is;
     it embeds the original, unprefixed slot id, and rewriting it would break
     host idempotency across a remount.

Every other queue-lifecycle site — the per-step reset, the two
clear-on-dep-error paths, the drain hand-off, and the parallel fresh-queue
literal in the dep runner — is mechanical, but it is *also* silent when
missed. The implementation task enumerates all eight.

### Diagnostic dedup

`unsupported-orders` fires **once per slot per mount**, following the
`diagnosedAlertConditionKeys` idiom (`packages/runtime/src/runtimeContext.ts:336`).
A capability-declined script would otherwise emit one diagnostic per order
per bar, which on a 10k-bar backfill is a denial-of-service on the diagnostic
channel rather than a warning.

### A mechanism debt in this change's path

`VALID_DIAGNOSTIC_CODES` in
`packages/adapter-kit/src/validation/validateEmission.ts` is missing
`tz-dst-unsupported`, which the `DiagnosticCode` union does carry. It is a
one-line pre-existing drift and it is *exactly* the failure the new
`unsupported-orders` code would repeat: a code in the union but absent from
the validation set is accepted by the type checker and rejected at runtime.
Fix it in the same edit that adds `unsupported-orders`, and note it in the
changeset. Leaving it is choosing to keep the trap warm.

---

## 8. Z-order interaction

**Nothing changes.** Auto-markers ride the plot pipeline, so they inherit
plot render ordering wholesale: the shared comparator orders by
`(z ?? 0, groupBand, declarationSeq)`, and marker emissions land in the
`glyph` band with the other `shape` / `character` / `arrow` plots — below
drawings, above series, by the existing band table.

Two consequences worth recording so no implementation task re-litigates
them:

- **Markers carry no author-settable `z`.** `OrderOpts` has no `z`, by
  design: a marker is a courtesy render of a data event, and an author who
  wants layered control emits their own `draw.*` glyph and passes
  `marker: false`. That is the third example script's whole point.
- **Repeated same-bar folds are idempotent.** Marker plots go through the
  ordinary plot queue, which is `(slotId, bar)` last-write-wins — so a
  synthetic `#marker` slot re-emitted for the same bar collapses, and the
  channel-level append-only rule (§6) applies to `orders`, not to the
  courtesy plots. The two dedup policies differ on purpose, on the same
  event, and that is consistent: the *event* must not be lost, the *picture*
  of it must not be doubled.

---

## 9. Converter feasibility

**Feasible, and it is an upgrade of an existing lowering rather than new
recognition machinery.**

### What exists

`packages/pine-converter/src/transform/strategySignals.ts` already
recognises the four signal members (`STRATEGY_SIGNALS`, `:8`; membership test
`:60`) and lowers them, losing everything structural: `emitStrategySignal`
(`:101`) pushes the `strategy-signal-only` diagnostic (`:109`) and returns
`alert("<id> <member>", { severity: "info" })` (`:113`). A `strategy(...)`
header is an **error**-severity `unsupported-strategy`, and
`strategy.long` / `strategy.short` fail as `unknown-identifier`.

### The target mapping

```
strategy.entry("Long", strategy.long)      →  order.buy({ label: "Long" })
strategy.entry("S", strategy.short)        →  order.sell({ label: "S" })
strategy.order("O", strategy.long, qty)    →  order.buy({ label: "O", qty })
strategy.close("Long") / close_all()       →  order.close({ label: "Long" }) / order.close()
strategy.exit("X", "Long", stop, limit)    →  order.close({ label: "X" })  + dropped-args diagnostic
```

`close_all` is new coverage — unhandled today, and cheap once the mapping
exists. `qty` passes through only when the Pine argument is a scalar the
converter can emit inline; otherwise it is omitted and the diagnostic says
so.

Diagnostics get refitted, not renumbered: keep the `strategy-signal-only`
code id (the generated diagnostics page is byte-diff gated, and a code
rename is a needless churn) and rewrite its message to name what survived
and what did not. `unsupported-strategy` drops from **error** to
**warning** — a strategy now converts usefully; only its backtester settings
are ignored.

### The naming collision, and its verified verdict

**Pine has its own, unrelated `order` namespace.**
`packages/pine-converter/src/semantic/builtins.ts:61-62` registers
`order.ascending` / `order.descending` — the `array.sort` direction enum —
and `:146` registers `order` in `NAMESPACE_NAMES`. So the Pine-side `order`
root and the chartlang-side `order` global share a spelling, in the one
package that reads both languages.

**Verified: the sort enum never emits a bare `order` identifier.**
`packages/pine-converter/src/mapping/arrayReductions.ts:119-122` maps both
members to the string literals `"asc"` / `"desc"`
(`ARRAY_SORT_ORDER_MAP`), and the emitter drops the argument entirely for
ascending. There is no path by which `array.sort(a, order.ascending)`
produces the token `order` in the output. The collision is therefore benign
today — but it is benign *by an implementation detail of one map*, so the
converter task pins it with a test that converts a script using **both**
`array.sort(a, order.ascending)` and `strategy.entry(...)` and asserts a
clean result.

Two live obligations follow, and both are about *position*:

1. **Resolve `strategy.long` / `strategy.short` at the callsite**, in
   argument position 2 of `entry` / `order` — **not** by adding them to the
   position-independent constants table, which would legalize
   `strategy.long` in any expression. A `strategy.long` outside a recognised
   signal call must keep failing as `unknown-identifier`, pinned by a test.
2. **Reserve the `order` name in the emitted script.** The generated code now
   imports and destructures `order`, so a Pine variable named `order` must be
   renamed by the name allocator rather than shadowing the namespace. Test
   that too.

### Emitted-import plumbing

The import specifier list is a **fixed** order, not alphabetical, and the
`ComputeContext` destructure list and the allocator's reserved-name list
move in lockstep with it. `order` is added to all three in the same edit;
the membership pin in the imports-minimization test is updated with them.

---

## 10. Skills surface impact

Both skills describe surfaces this RFC changes, so both are in scope by the
root rule ("when you change anything a skill in `skills/` describes, update
that skill in the same PR").

**`skills/chartlang-coding/` (author skill).**

- The frontmatter `description` is the trigger surface — it must enumerate
  `order.*` (and the four call names) or the skill will not fire on "write me
  a strategy".
- The generated `references/primitives.md` is **not** free. It comes from
  `scripts/generate-skills-reference.ts`, which builds namespace sections off
  the Phase-4 doc entries; the helper that renders a namespace has a
  **narrowly typed** title parameter that must be widened before `order` can
  be passed to it. So this is a small generator change plus a regenerate,
  and the byte-diff `skills:gate` enforces the commit.
- The hand-written surface section gains an order block, and the
  common-mistakes section gains the two mistakes this design predicts:
  reading `order.position()` and expecting the *same* bar's orders to be
  reflected (§7's lag), and reaching for alert prefixes to carry backtest
  signals (now obsolete).
- `references/translating-from-pine.md` currently teaches emitting orders as
  `alert(...)`. That guidance is *wrong* after Task 10, not merely
  incomplete — the mapping rows from §9 replace it.
- `references/examples.md` is hand-written and ungated; it gains the
  `order-ema-cross` worked example.

**`skills/chartlang-setup/` (integrator skill).** The adapter reference gains
the `orders` capability and the `onOrder` sink pattern (the door an embedding
app actually uses); the server-alerts reference records that a server-side
evaluator may declare `orders: false` and ignore the channel, on the drawings
precedent.

**Hover / completion needs no language-service change.** The hover registry
generator recurses into frozen object-literal members, so `order` and its
four members appear from the core JSDoc alone — provided each carries a
summary and `@since`, which the generator requires and silently drops symbols
for. The registry's key-count pin moves by five (the namespace plus four
members).

The hand-written `docs/skills/*.md` mirrors are ungated and therefore the
easiest surface in the repo to forget.

---

## 11. react-starter surface impact

**The seam is unaffected. The feature reaches the starter through the
compiler and the adapter, not through the seam.**

The library-agnostic seam (`apps/react-starter/src/lib/chart/activeAdapter.ts`
+ `seamVariants.ts`) wraps adapter creation and the run loop; it touches
neither the language surface nor the emission envelope. Because auto-markers
are ordinary `arrow` / `label` plot emissions (§5), an order-emitting script
draws correctly in every seam variant with **zero** seam change.

What the starter does gain is the *structured* half, and it is deliberately
minimal: an optional `onOrder` sink beside the existing `onAlert` feed, and a
small list of recent orders. The starter is what
`npm create @invinite-org/chartlang` clones, so its job here is to
demonstrate exactly one thing — "this is how you read
`RunnerEmissions.orders`" — and specifically **not** to demonstrate a
simulated equity curve, which would contradict §3's rejection of
language-owned economics in the very artifact new users copy.

The all-variants byte-identity check stays green as verification, not
migration.

---

## 12. Implementation plan & risks

The implementation is the sibling tasklist
`chartlang-order-backtesting/`, tasks 2–12 in this repo followed by a manual
release. One row per task, so this table is checkable against it.

| Task | Surface | Work | Size |
|---|---|---|---|
| 2 | **core** | `order/` module (types + frozen throwing namespace), four `STATEFUL_PRIMITIVES` entries, `ComputeContext.order`, `CapabilityId += "orders"`, barrel exports, JSDoc that survives the hover + docs generators | M |
| 3 | **adapter-kit** | `OrderEmission`, `RunnerEmissions.orders` (after `alertConditions`), `Capabilities.orders`, `unsupported-orders` code, `validateEmission` arm, capability builder, exports — plus the `tz-dst-unsupported` drift fix (§7). Compile-breaking by design across every `Capabilities` literal | M |
| 4 | **compiler + hosts** | Ambient-shim mirror (types, `const order`, `ComputeContext` field, its own `CapabilityId` union), callsite→`"orders"` extraction, host-worker validation loop, host-quickjs drain partition + empty envelope. Slot injection is generic and needs no per-namespace code | M |
| 5 | **runtime — plumbing** | `emit/order.ts` (capability gate, opts validation, meta snapshot, `dedupeKey`), append-only `pushOrder`, context binding, and the eight-site queue-lifecycle sweep incl. the history accumulator and the dep/sibling policy (§7) | L |
| 6 | **runtime — semantics** | Confirmed-step fold + fold arithmetic, auto-marker lowering, snapshot round-trip (optional field, version stays 2), tick + halt discipline, cross-host byte parity | L |
| 7 | **conformance + generators** | `order-count` / `order-at-bar` assertions + `BufferedRun` channel, three scenarios (emitting, capability-gated, position-reads), inventory-gate arithmetic, hover regen, four generated primitive pages, coverage-map arm, skills-generator namespace section | M |
| 8 | **examples + adapters** | `orders` example category + three scripts, primitive-page credits, six adapters to `orders: true`, six optional `onOrder` forwards, vendored CLI bundle + conformance report regeneration | M |
| 9 | **demo apps** | Site playground `onOrder` sink + orders panel + driver plumbing; react-starter orders feed; e2e across all six adapters | M |
| 10 | **pine-converter** | `strategy.*` → `order.*` lowering, `strategy.long` / `short` positional intrinsics, diagnostic refit + severity drop, `order` import/destructure/reservation, collision test, fixtures | M |
| 11 | **docs + skills** | `docs/language/orders.md`, normative spec updates (emissions, semantics queue list, manifest, versioning, pine-migration), glossary, adapter docs, both skills + mirrors, per-package `CLAUDE.md` invariants | M |
| 12 | **release prep** | Changesets (minor for every touched published package — the examples package bump is what fires the downstream dispatch), full gate battery, linked-starter preview on ≥3 adapters | S |

**Top risks.**

1. **A missed queue-lifecycle site (highest).** Every one of the eight sites
   fails *silently* — no type error, no diagnostic, just orders that vanish
   at a drain or a bar boundary. The history accumulator is the worst because
   it degrades to "only the last bar", which looks like a script bug.
   Mitigation: enumerate the sites in the task, and pin the accumulator with
   its own three-bar regression test.
2. **Snapshot omission.** A position lost across a Durable Object eviction
   inverts every later signal and presents as a strategy that changed its
   mind. Mitigation: additive optional field, absence means flat, round-trip
   test plus a legacy-snapshot test.
3. **The tick / fold boundary.** Folding on ticks double-applies; not
   emitting on ticks makes live orders invisible until close. The accepted
   split (emit always, fold only on confirmed steps) is the one that matches
   both alerts and Pine — and it needs a test that ticks the same order twice
   and asserts exactly one fold.
4. **Capability-literal breakage for external integrators.** `orders` is a
   required key, so every hand-written `Capabilities` bag outside this
   workspace fails to compile on upgrade. Mitigation: it is enumerable and
   loud (never silent), and the changeset says so explicitly.
5. **The converter's `order` spelling collision.** Benign today by one map's
   implementation detail (§9). Mitigation: pin it with a both-features test
   rather than trusting the detail to persist.
6. **Generator surfaces that fail closed.** The coverage gate *throws* on an
   unmapped primitive page directory, and the skills generator will not pick
   up a namespace without a widened parameter. Both are hard CI failures
   mid-branch by construction; the task ordering absorbs them and task 12
   runs the full battery once.

**Non-goals restated:** limit / stop / bracket orders; any economic
simulation; `qty` economics in the nominal tracker; a set-of-kinds
`orders` capability; trade-narrative `ta.*` primitives; server-side order
consumption in the motivating consumer.

---

## 13. Decision

**Accepted.** Ship the `order.*` namespace (`buy` / `sell` / `close` /
`position`) inside `defineIndicator` with a callsite-derived `orders`
`CapabilityId`, an append-only `RunnerEmissions.orders` channel of
`OrderEmission`s gated by `Capabilities.orders`, runtime-tracked nominal
position folded on confirmed steps, and auto-rendered `arrow` / `label`
plots with a per-call `marker: false` opt-out. Fill economics stay in the
consumer. Additive within `apiVersion: 1`; no new script kind; no adapter
rendering migration.

- [x] **Accept** — decided by the owner (Julian) **2026-08-17**. Implement per
      §12 (tasks 2–12), then release manually.
- [ ] **Accept with revisions**
- [ ] **Reject** — keep `strategy.* → alert(...)` and leave consumers parsing
      message prefixes.

### Deferral reversals recorded

This decision reverses two previously recorded deferrals. Both statements are
now wrong and are corrected by the docs task, not here:

1. `docs/spec/pine-migration.md:379-384` — "Strategy primitives are Beyond
   1.0 and require a future `Capabilities.strategy` flag." **Reversed on both
   counts:** the surface lands inside `apiVersion: 1.x`, and the shipped
   mechanism is `Capabilities.orders` (a boolean on the adapter bag, §6), not
   a `Capabilities.strategy` flag. The feature-matrix row at `:373` ("No
   order, fill, P&L, or equity-curve language in v1") becomes partially
   wrong: *order* language ships; *fill, P&L, and equity-curve* language
   remains deliberately absent (§3 option D), and the rewritten row must
   preserve that distinction rather than flipping the whole cell.
2. `tasks/old/pine-parity-additions/README.md:164-166` — "Strategy /
   backtesting (`strategy.*`) — position model, fills, equity curve,
   performance report + an order-execution determinism contract. Large;
   likely `apiVersion` scope decision. Out of scope." **Partially reversed,
   and its reasoning is upheld:** the *position model* and the order surface
   ship additively; *fills, equity curve, and performance report* stay out of
   the language for exactly the reason that entry predicted — they are an
   `apiVersion`-scale commitment to a fill policy. The split between those
   two halves is the substance of this RFC.

### Open questions

None blocking; all five design questions were decided by the owner on
2026-08-17 and are recorded in §0. Two items are explicitly *scheduled*
rather than open:

1. **`qty` economics.** Emitted and surfaced from v1, ignored by the nominal
   tracker. Whether the tracker ever honours partial closes is a follow-up,
   not an omission.
2. **A set-of-kinds `orders` capability.** Reserved for `apiVersion: 2`, and
   only if limit / stop orders land — a boolean is the honest shape for a
   market-only surface.

---

## 14. Errata (recorded 2026-08-18, post-implementation)

Three claims in the accepted text turned out to be factually wrong, and one
instruction turned out to contradict a rule this RFC states elsewhere. **No
decision changes** — every one of the five accepted decisions shipped as
written, and the sections above are left as they were accepted so the record
stays honest about what was believed at decision time. What follows is what
implementing them measured.

### E1 — §6: "the existing optional `onAlert` factory option" is not universal

§6 cites `onAlert` as the precedent an `onOrder` sibling mirrors, implying every
bundled adapter already has one. Five do. **`examples/konva-adapter/` has
none** — its only occurrence of the string is a comment recording that alert
badges are still deferred there. So `onOrder` is konva's *first* per-emission
app sink, not a sibling of an existing one.

The decision is unaffected (the sink is still optional, still forwards the
validated array, and all six adapters ship one now); only the "already has a
precedent everywhere" framing was wrong.

### E2 — §11: the react-starter **seam** was not unaffected

§11 states "the seam is unaffected… an optional `onOrder` sink beside the
existing `onAlert` feed" — and those two halves contradict each other.

True of *rendering*: auto-markers are ordinary `arrow` / `label` plot
emissions, so an order-emitting script draws correctly in every seam variant
with zero seam change. **False of the sink §11 itself asks for.** `ChartPane`
reaches an adapter only through `createActiveAdapter`, and no adapter accepts a
sink after construction, so `CreateAdapterOpts` had to gain `onOrder?` and all
six emitted seams had to forward it — a change that reaches the published
`@invinite-org/create-chartlang` (`seamTemplates.ts`), not just this repo.

The all-variants byte-identity check stayed green after the coordinated change,
which is what §11 meant to promise; it was not free.

### E3 — §9: the `order` collision is benign only for the *recognised* form

§9 verifies that `ARRAY_SORT_ORDER_MAP` maps `order.ascending` /
`order.descending` to the string literals `"asc"` / `"desc"` and concludes
there is "no path by which `array.sort(a, order.ascending)` produces the token
`order` in the output". That holds only when the sort's collection argument
**resolves to a recognised collection slot**. Over an *unrecognised* collection
the argument is passed through verbatim, so the Pine enum reaches the emitted
text as a bare `order.ascending`.

That is a pre-existing leak of the array lowering, not something this feature
introduced — but it makes the naive detector unsafe. A `\border\b` usage scan
would have imported chartlang's unrelated `order` namespace into a script that
never calls an order primitive. The shipped converter therefore keys its
`order` usage flag on **members**
(`/\border\.(?:buy|sell|close|position)\(/`), and the both-features test §9
prescribes is pinned against that.

### E4 — §6's remedy for the stale capability count was superseded by §5's rule

§6 closes by telling the docs task to write `15` where
`docs/spec/emissions.md` said `13`. §5 of this same RFC forbids restating a
total, on the evidence that the restated one goes stale. Both cannot hold, and
§5 is right: `emissions.md` turned out to carry **four** stale totals, not one,
and two of the tables they counted were themselves missing members
(`PlotKind` lacked `candle` / `ohlc-bar`, `DrawingKind` lacked `fill-between`,
the diagnostic table lacked nine codes).

The docs task therefore completed the enumerating tables and **deleted every
numeral** rather than writing `15`. The enumeration is now the count, and
`emissions.md` names the four exported types to re-extract from instead.
