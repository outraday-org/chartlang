// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { JsonValue } from "../types.js";
import { order } from "./order.js";
import type { OrderAction, OrderNamespace, OrderOpts, OrderPosition } from "./order.js";

// A runtime implementation must satisfy the namespace structurally — this is the
// shape `ComputeContext.order` is installed with.
const runtimeOrder: OrderNamespace = {
    buy: (_opts) => undefined,
    sell: (_opts) => undefined,
    close: (_opts) => undefined,
    position: () => ({ size: 0, avgPrice: null, entryBar: null }),
};

describe("order namespace type surface", () => {
    it("derives OrderNamespace from the frozen namespace object", () => {
        expectTypeOf(order).toEqualTypeOf<OrderNamespace>();
        expectTypeOf(runtimeOrder).toEqualTypeOf<OrderNamespace>();
    });

    it("declares exactly buy / sell / close / position", () => {
        expectTypeOf<keyof OrderNamespace>().toEqualTypeOf<"buy" | "sell" | "close" | "position">();
    });

    it("the three emitters take optional OrderOpts and return void", () => {
        expectTypeOf(order.buy).parameter(0).toEqualTypeOf<OrderOpts | undefined>();
        expectTypeOf(order.sell).parameter(0).toEqualTypeOf<OrderOpts | undefined>();
        expectTypeOf(order.close).parameter(0).toEqualTypeOf<OrderOpts | undefined>();
        expectTypeOf(order.buy).returns.toBeVoid();
        expectTypeOf(order.sell).returns.toBeVoid();
        expectTypeOf(order.close).returns.toBeVoid();
    });

    it("order.position takes no argument and returns OrderPosition", () => {
        expectTypeOf(order.position).parameters.toEqualTypeOf<[]>();
        expectTypeOf(order.position).returns.toEqualTypeOf<OrderPosition>();
    });

    it("OrderAction carries the three market intents", () => {
        expectTypeOf<OrderAction>().toEqualTypeOf<"buy" | "sell" | "close">();
    });

    it("OrderOpts fields are all optional and JSON-clean", () => {
        expectTypeOf<OrderOpts>().toEqualTypeOf<
            Readonly<{
                qty?: number;
                label?: string;
                marker?: boolean;
                meta?: Readonly<Record<string, JsonValue>>;
            }>
        >();
        expectTypeOf({}).toMatchTypeOf<OrderOpts>();
        expectTypeOf({ qty: 1, label: "Long", marker: false }).toMatchTypeOf<OrderOpts>();
        expectTypeOf({
            meta: { reason: "cross", strength: 0.4, ok: true },
        }).toMatchTypeOf<OrderOpts>();
    });

    it("OrderPosition is a signed size with nullable nominal price and entry bar", () => {
        expectTypeOf<OrderPosition>().toEqualTypeOf<
            Readonly<{ size: number; avgPrice: number | null; entryBar: number | null }>
        >();
        expectTypeOf<OrderPosition["size"]>().toEqualTypeOf<number>();
        expectTypeOf<OrderPosition["avgPrice"]>().toEqualTypeOf<number | null>();
        expectTypeOf<OrderPosition["entryBar"]>().toEqualTypeOf<number | null>();
    });
});
