// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Series } from "../types.js";
import type {
    RequestNamespace,
    RequestSecurityOpts,
    request,
    SecurityBar,
    SecurityExpr,
} from "./request.js";

const numberSeries: Series<number> = { current: 0, length: 0 };
const stringSeries: Series<string> = { current: "", length: 0 };

const securityBar: SecurityBar = {
    time: numberSeries,
    open: numberSeries,
    high: numberSeries,
    low: numberSeries,
    close: numberSeries,
    volume: numberSeries,
    hl2: numberSeries,
    hlc3: numberSeries,
    ohlc4: numberSeries,
    hlcc4: numberSeries,
    symbol: stringSeries,
    interval: stringSeries,
};

const runtimeRequest: RequestNamespace = {
    security: (_opts) => securityBar,
};

describe("request namespace type surface", () => {
    it("accepts the minimum request.security opts shape with optional symbol", () => {
        expectTypeOf<RequestSecurityOpts>().toEqualTypeOf<
            Readonly<{ symbol?: string; interval: string }>
        >();
        // symbol omitted (chart-symbol back-compat) and symbol-bearing both match
        expectTypeOf({ interval: "5m" }).toMatchTypeOf<RequestSecurityOpts>();
        expectTypeOf({ symbol: "AMEX:SPY", interval: "1D" }).toMatchTypeOf<RequestSecurityOpts>();
        expectTypeOf<RequestSecurityOpts["symbol"]>().toEqualTypeOf<string | undefined>();
    });

    it("returns SecurityBar from a runtime-provided namespace", () => {
        expectTypeOf(runtimeRequest.security({ interval: "1D" })).toEqualTypeOf<SecurityBar>();
        expectTypeOf(runtimeRequest.security).parameter(0).toEqualTypeOf<RequestSecurityOpts>();
    });

    it("data form resolves to SecurityBar, expression form to Series<number>", () => {
        // `request.security` throws when invoked outside a script step, so probe
        // the overload through a non-invoking typed alias of the same shape.
        const security: typeof request.security = (() => undefined) as never;
        expectTypeOf(security({ interval: "1W" })).toEqualTypeOf<SecurityBar>();
        expectTypeOf(security({ interval: "1W" }, (bar) => bar.close)).toEqualTypeOf<
            Series<number>
        >();
        // both overloads also accept a different-symbol opts object
        expectTypeOf(security({ symbol: "AMEX:SPY", interval: "1D" })).toEqualTypeOf<SecurityBar>();
        expectTypeOf(
            security({ symbol: "AMEX:SPY", interval: "1D" }, (bar) => bar.close),
        ).toEqualTypeOf<Series<number>>();
    });

    it("SecurityExpr accepts series-returning and number-returning callbacks", () => {
        const fromSeries: SecurityExpr = (bar) => bar.close;
        const fromNumber: SecurityExpr = (bar) => bar.close.current * 2;
        expectTypeOf(fromSeries).toEqualTypeOf<SecurityExpr>();
        expectTypeOf(fromNumber).toEqualTypeOf<SecurityExpr>();
        expectTypeOf<SecurityExpr>().returns.toEqualTypeOf<Series<number> | number>();
        expectTypeOf<SecurityExpr>().parameter(0).toEqualTypeOf<SecurityBar>();
    });
});
