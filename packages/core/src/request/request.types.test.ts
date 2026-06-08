// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Series } from "../types";
import type { RequestNamespace, RequestSecurityOpts, SecurityBar } from "./request";

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
    it("accepts the minimum request.security opts shape", () => {
        expectTypeOf<RequestSecurityOpts>().toEqualTypeOf<Readonly<{ interval: string }>>();
        expectTypeOf({ interval: "5m" }).toMatchTypeOf<RequestSecurityOpts>();
    });

    it("returns SecurityBar from a runtime-provided namespace", () => {
        expectTypeOf(runtimeRequest.security({ interval: "1D" })).toEqualTypeOf<SecurityBar>();
        expectTypeOf(runtimeRequest.security).parameter(0).toEqualTypeOf<RequestSecurityOpts>();
    });
});
