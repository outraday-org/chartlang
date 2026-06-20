# `draw.text`

> **Stability:** stable
> **Since:** 0.3
> **Bucket:** `labels`
> **Wire kind:** `text`

Draw a freeform text annotation anchored at a single world point.
The `body` string surfaces in the rendered glyph; the validator pins
it as a non-empty string of length ≤ 256 (longer than the 128 cap on
plot labels — annotation strings carry short rationales like
"Inverse Head and Shoulders Confirmed"). Mirrors invinite's
`text-tool.ts` shape.

## Anchors

`anchor` — single `WorldPoint`

Anchor count: 1.

## Signature

```ts
function text(anchor: WorldPoint, body: string, opts?: TextOpts): DrawingHandle;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `draw.text(...)` without it._

## Example

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
    export default defineIndicator({
        name: "draw.text demo",
        apiVersion: 1,
        compute({ bar, draw }) {
            draw.text(
                { time: bar.time, price: bar.high },
                "Peak",
                { color: "#1e293b", size: "normal" },
            );
        },
    });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/annotations/text.ts)
- [`draw.*` namespace index](./index.md)
