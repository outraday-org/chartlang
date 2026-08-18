// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

// The four `docs/primitives/order/*.md` pages are split across three scripts,
// one credit each except the flagship (which owns both the entry emitter and
// the position read). Nothing here re-credits `ta.ema` / `ta.crossover` /
// `ta.crossunder` / `draw.arrowMarkUp`: each already has a dedicated
// single-primitive default, and a composite must not preempt the entry that
// owns the coverage (the fold rule in `examples/CLAUDE.md`).
const ORDERS_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "order-ema-cross",
        label: "Order EMA Cross",
        description:
            "order.buy / order.position — the golden-cross strategy shape: an EMA(12)/EMA(26) crossover opens a long and a crossunder closes it, each leg guarded by a read of the nominal position so the script never doubles an entry. The runtime auto-renders the entry/exit arrows through the plot pipeline, so no drawing code appears anywhere.",
        category: "orders",
        primitives: ["order.buy", "order.position"],
    },
    {
        id: "order-rsi-reversal",
        label: "Order RSI Reversal",
        description:
            "order.sell — a long/short mean-reversion reversal: RSI(14) below 30 buys, above 70 sells short, and each branch reads the SIGNED position size so a signal against an open position reverses it in one order instead of stacking. Both legs pass an explicit unsigned qty (the action names the side).",
        category: "orders",
        primitives: ["order.sell"],
    },
    {
        id: "order-silent-markers",
        label: "Order Silent Markers",
        description:
            "order.close — the marker opt-out: the entry passes marker: false and draws its own draw.arrowMarkUp glyph instead, while the exit keeps the auto-rendered arrow. Both orders ride the wire identically, which is the point — the orders channel is the data and the markers are a courtesy render.",
        category: "orders",
        primitives: ["order.close"],
    },
];

export default ORDERS_FRAGMENT;
