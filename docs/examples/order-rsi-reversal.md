# Order RSI Reversal

order.sell — a long/short mean-reversion reversal: RSI(14) below 30 buys, above 70 sells short, and each branch reads the SIGNED position size so a signal against an open position reverses it in one order instead of stacking. Both legs pass an explicit unsigned qty (the action names the side).

[Try it live](https://chartlang.invinite.com/?script=order-rsi-reversal#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Order RSI Reversal",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline, order }) {
        const rsi = ta.rsi(bar.close, 14);

        plot(rsi, { color: "#2563eb", title: "RSI(14)" });
        hline(70, { title: "Overbought", color: "#ef4444", lineStyle: "dashed" });
        hline(30, { title: "Oversold", color: "#16a34a", lineStyle: "dashed" });

        const oversold = rsi.current < 30;
        const overbought = rsi.current > 70;

        // The position is SIGNED: `> 0` long, `< 0` short, `0` flat. That is the
        // whole reason this reversal needs no `state.bool` flag — the runtime's
        // own bookkeeping already distinguishes the three cases, and a flag
        // maintained beside it would eventually disagree with it.
        const size = order.position().size;

        // `qty` is an UNSIGNED magnitude; the action names the side. A buy while
        // short crosses zero and REVERSES the position in one order rather than
        // stacking, so the two guards below only have to exclude "already on
        // this side" — not model the flip.
        if (oversold && size <= 0) {
            order.buy({ qty: 2, label: "Long" });
        }
        if (overbought && size >= 0) {
            order.sell({ qty: 2, label: "Short" });
        }

        // The nominal tracker prices a fold at the SIGNAL bar's close and knows
        // nothing of capital, slippage or commission. A consumer that fills at
        // the next bar's open will legitimately report a different average price
        // than `order.position().avgPrice` — the language owns the signal, the
        // consumer's simulator owns the economics.
    },
});
```
