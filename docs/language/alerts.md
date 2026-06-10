# Alerts

chartlang has three alert surfaces:

| Surface | When it fires | Constructor |
| --- | --- | --- |
| `alert(message, opts?)` | immediately, when `compute` reaches the call | any `define*` |
| `defineAlertCondition` + `signal(id, fired)` | when the host wires a named condition to a delivery channel | `defineAlertCondition` |
| `runtime.log.info/warn/error` | every step, as debug output (not user-facing) | any `define*` |

## Immediate alerts: `alert(...)`

```ts
import { alert, defineIndicator, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA cross alert",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, alert }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);
        if (ta.crossover(fast, slow).current) {
            alert("EMA(12) crossed above EMA(26)", {
                severity: "info",
                meta: { fast: fast.current, slow: slow.current },
            });
        }
    },
});
```

The runtime de-duplicates alerts within one drained batch by
`(slotId, bar)`: a second call from the same callsite for the same bar
replaces the first. The emitted `dedupeKey` is stable across runs and is
the idempotency key adapters use for async delivery
(see [AlertEmission](../spec/emissions.md#alertemission)).

`opts.severity` is one of `"info" | "warning" | "critical"` and defaults
to `"info"`. `opts.meta` is JSON-clean payload metadata an adapter can
forward to webhooks, email templates, or toast UIs. `NaN`, `Infinity`,
functions, and `bigint` are rejected by the wire validator.

Alerts are gated by `Capabilities.alerts`. If an adapter declares no
alert channels, the runtime drops the emission and emits an
`unsupported-alert-channel` diagnostic.

## User-wireable conditions: `defineAlertCondition`

`defineAlertCondition` lets a script declare named conditions a host can
expose in an alert-creation UI. The user picks a condition, supplies a
message template, and routes the channel. The script signals when each
condition is or isn't currently firing:

```ts
import { defineAlertCondition, ta } from "@invinite-org/chartlang-core";

export default defineAlertCondition({
    name: "EMA cross",
    apiVersion: 1,
    conditions: {
        up: {
            title: "Bullish cross",
            description: "Fast EMA crossed above slow EMA.",
            defaultMessage: "{{ticker}} EMA cross up",
        },
        down: {
            title: "Bearish cross",
            description: "Fast EMA crossed below slow EMA.",
            defaultMessage: "{{ticker}} EMA cross down",
        },
    },
    compute({ bar, ta, signal }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);
        signal?.("up", ta.crossover(fast, slow).current);
        signal?.("down", ta.crossunder(fast, slow).current);
    },
});
```

Condition ids, titles, descriptions, and default messages must be
literals — the compiler walks them statically and writes them into
`manifest.alertConditions`. Each `signal(id, fired)` emission carries
the literal descriptor copied from the manifest plus the runtime
`(bar, time)`.

Both `fired: true` and `fired: false` transitions are emitted when the
adapter supports them, so a host can render an "armed / disarmed" UI
without inferring transitions from a stream of one-shot events.

Adapters gate signals with `Capabilities.alertConditions`. If `false`,
the runtime drops the signal and emits `alert-conditions-not-supported`
once per condition id.

## Runtime logs

`runtime.log.info`, `runtime.log.warn`, and `runtime.log.error` are
non-rendered debug output. They land in the `logs` queue of the next
drained `RunnerEmissions` batch and can be inspected by hosts or
editors.

```ts
import { defineIndicator, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA log demo",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, runtime }) {
        const ema = ta.ema(bar.close, 14);
        if (Number.isNaN(ema.current)) {
            runtime.log.info("ema warming", { bar: bar.time });
        }
    },
});
```

Adapters gate logs with `Capabilities.logs`. When `false`,
`runtime.log.*` is a silent no-op and no diagnostic is emitted. When
`true`, more than 1000 log emissions in one compute step are dropped
after one `runtime-log-budget-exceeded` diagnostic.

`runtime.error(message)` halts the current step with a fatal
`runtime-error-thrown` diagnostic. The script stays mounted; the next
bar runs normally.

## Cross-links

- Wire shapes: [Emission payloads § AlertEmission, AlertConditionEmission, LogEmission](../spec/emissions.md#alertemission).
- Dedupe and capability rules: [Execution semantics § Alert deduplication](../spec/semantics.md#alert-deduplication).
- Constructor schema: [grammar § defineAlertCondition](../spec/grammar.md#definealertcondition).
- Auto-generated reference: [alert primitive](../primitives/alert/alert.md).
