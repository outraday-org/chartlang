# `draw.group`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `other`
> **Wire kind:** `group`

Group a set of previously emitted drawing handles under a single
logical container. The script-author passes the handle ids
collected from earlier `draw.<kind>(...).id` calls; the runtime
carries the list on the wire as a `GroupState`, and the adapter
renders nothing of its own — children render themselves.

## Anchors

`childHandleIds` — a `ReadonlyArray<string>` of handle ids

Anchor count: 0 (metadata-only container).

## Signature

```ts
function group(childHandleIds: ReadonlyArray<string>): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.group(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.group demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            const a = draw.line(
                { time: bar.time, price: bar.low },
                { time: bar.time + 60_000, price: bar.high },
            );
            const b = draw.line(
                { time: bar.time, price: bar.high },
                { time: bar.time + 60_000, price: bar.low },
            );
            draw.group([a.id, b.id]);
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/containers/group.ts)
- [`draw.*` namespace index](./index.md)
