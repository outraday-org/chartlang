// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION, VALID_DEFINE } from "./__fixtures__/scripts.js";
import { CompileError, compile } from "./api.js";

const HOSTILE = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "bad",
    apiVersion: 1,
    compute: () => { Math.random(); },
});
`;

describe("compile", () => {
    it("resolves core from `inMemoryModules` when provided", async () => {
        const result = await compile(VALID_DEFINE, {
            apiVersion: 1,
            sourcePath: "x.chart.ts",
            inMemoryModules: {
                "@invinite-org/chartlang-core": `
export function defineIndicator(o){ const __m = "IN_MEMORY_CORE_MARKER"; return { ...o, __m }; }
`,
            },
        });
        expect(result.moduleSource).toContain("IN_MEMORY_CORE_MARKER");
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
    });

    it("returns a frozen CompiledScript for the EMA-cross fixture", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(result.moduleSource).toContain("export const __manifest = ");
        expect(result.types).toContain("export default script");
        expect(result.manifest.name).toBe("EMA cross");
        expect(result.manifest.capabilities).toEqual(["alerts", "indicators"]);
    });

    it("emits 4 distinct callsite-id literals for the EMA-cross fixture", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        // 4 stateful callsites are rewritten with an injected id. The single
        // `plot` callsite's id also appears in the appended `__manifest`
        // `plots` array (the manifest echoes the injected id), so dedupe to
        // count distinct injected ids.
        const matches = result.moduleSource.match(/"ema-cross\.chart\.ts:\d+:\d+#0"/g) ?? [];
        expect(new Set(matches).size).toBe(4);
    });

    it("type-checks input presentation metadata through the ambient shim", async () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const schema = { kind: "external-series-schema" } as const;
export default defineIndicator({
    name: "metadata",
    apiVersion: 1,
    inputs: {
        length: input.int(20, {
            title: "Length",
            group: "MA",
            inline: "1",
            tooltip: "Moving average length",
            display: "data-window",
            confirm: true,
        }),
        earnings: input.externalSeries({
            name: "earnings",
            schema,
            group: "Events",
            inline: "2",
            tooltip: "Adapter data",
            display: "status-line",
            confirm: false,
        }),
    },
    compute: () => {},
});
`;
        const result = await compile(source, {
            apiVersion: 1,
            sourcePath: "input-metadata.chart.ts",
        });

        expect(result.manifest.inputs.length).toMatchObject({
            group: "MA",
            inline: "1",
            tooltip: "Moving average length",
            display: "data-window",
            confirm: true,
        });
        expect(result.manifest.inputs.earnings).toMatchObject({
            group: "Events",
            inline: "2",
            tooltip: "Adapter data",
            display: "status-line",
            confirm: false,
        });
    });

    it("type-checks the request.security expression overload through the ambient shim", async () => {
        // Regression for the ambient-shim overload-collapse bug: the shim's
        // `RequestNamespace` was a `Readonly<{ security(opts): SecurityBar;
        // security(opts, expr): Series<number> }>` object type, and `Readonly`
        // (a homomorphic mapped type) collapsed the two `security` overloads
        // to one — so the full `compile()` type-check rejected the expression
        // form with TS2554 ("Expected 1 arguments, but got 2"). The shim now
        // declares `RequestNamespace` as an `interface`, which preserves both
        // overloads. `transformAndAnalyse` (analysis-only) never exercised the
        // type-check, so this guard must go through `compile`.
        const EXPR_FORM = `
import { defineIndicator, plot, request, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "htf",
    apiVersion: 1,
    compute({ ta, plot, request }) {
        const weekly = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
        plot(weekly, { color: "#ef5350", title: "Weekly EMA(20)" });
    },
});
`;
        const result = await compile(EXPR_FORM, {
            apiVersion: 1,
            sourcePath: "htf.chart.ts",
        });
        expect(result.manifest.requestedIntervals).toEqual(["1W"]);
        expect(result.manifest.securityExpressions).toEqual([
            { slotId: "htf.chart.ts:7:24#0", interval: "1W", paramName: "bar" },
        ]);
        // The data-only overload still type-checks (one argument).
        const DATA_FORM = `
import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "data",
    apiVersion: 1,
    compute({ plot, request }) {
        const weekly = request.security({ interval: "1W" });
        plot(weekly.close);
    },
});
`;
        const dataResult = await compile(DATA_FORM, {
            apiVersion: 1,
            sourcePath: "data.chart.ts",
        });
        expect(dataResult.manifest.securityExpressions).toBeUndefined();
        // The widened opts (`{ symbol, interval }`) type-checks through both
        // overloads — the symbol field is optional, so the symbol-omitted forms
        // above stay green while this different-symbol form compiles too.
        const SYMBOL_FORM = `
import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ratio",
    apiVersion: 1,
    compute({ plot, request }) {
        const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
        const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
        plot(spy.close.current / qqq.close.current, { title: "SPY/QQQ" });
    },
});
`;
        // compile() throws on any type error, so a successful return proves the
        // symbol-bearing opts type-check through the shim. The compiler now
        // extracts the two distinct symbols into `requestedFeeds` (sorted by
        // `feedKey`), while `requestedIntervals` stays the main-symbol projection
        // (empty here — both feeds carry a non-chart symbol).
        const symbolResult = await compile(SYMBOL_FORM, {
            apiVersion: 1,
            sourcePath: "ratio.chart.ts",
        });
        expect(symbolResult.manifest.securityExpressions).toBeUndefined();
        expect(symbolResult.manifest.requestedFeeds).toEqual([
            { symbol: "AMEX:SPY", interval: "1D" },
            { symbol: "NASDAQ:QQQ", interval: "1D" },
        ]);
        expect(symbolResult.manifest.requestedIntervals).toEqual([]);
        // A symbol-omitted (chart-symbol HTF) request lists a `{ interval }` feed
        // AND keeps its interval in `requestedIntervals` — byte-compat.
        expect(dataResult.manifest.requestedFeeds).toEqual([{ interval: "1W" }]);
        expect(dataResult.manifest.requestedIntervals).toEqual(["1W"]);
        // A script with no request.security omits `requestedFeeds` entirely.
        const NO_REQUEST = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "plain",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`;
        const plainResult = await compile(NO_REQUEST, {
            apiVersion: 1,
            sourcePath: "plain.chart.ts",
        });
        expect(plainResult.manifest.requestedFeeds).toBeUndefined();
    });

    it("type-checks direct bar.close indexing and arithmetic through the ambient shim", async () => {
        // `bar.close` (the compute bar) is now a `PriceSeries` — both a scalar
        // (`bar.close * 2`, `plot(bar.close)`) and an indexable series
        // (`bar.close[1]`). Before this change `bar.close[1]` was a TS error
        // ("number has no index signature"); the only way to index a price was
        // the `ta.ema(bar.close, 1)` identity trick. `transformAndAnalyse` does
        // not type-check, so the guard must go through `compile`.
        const DIRECT_INDEX = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "direct",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const manual =
            (bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) / 5;
        const doubled = bar.close * 2;
        plot(manual, { title: "Manual SMA(5)" });
        plot(bar.close, { title: "Close" });
        plot(doubled, { title: "2x close" });
    },
});
`;
        // compile() throws a CompileError on any type error, so a successful
        // return already proves `bar.close[1]` / `bar.close * 2` type-check.
        const result = await compile(DIRECT_INDEX, {
            apiVersion: 1,
            sourcePath: "direct.chart.ts",
        });
        // The literal `bar.close[4]` widened the OHLCV ring buffer to retain at
        // least 5 slots (maxLookback = 4).
        expect(result.manifest.maxLookback).toBeGreaterThanOrEqual(4);
    });

    it("type-checks a state.series writable + indexable slot through the ambient shim", async () => {
        // `state.series(0)` returns a `NumberSeriesSlot` (`MutableSlot<number> &
        // Series<number>`) — both a writable scalar slot (`s.value = …`) and an
        // indexable, number-coercible series (`s[1]`, `+s`) usable as a `ta.*`
        // source. `transformAndAnalyse` (analysis-only) does not type-check, so
        // this guard — which proves the shim's `StateNamespace.series` signature
        // and `NumberSeriesSlot` alias are correct — must go through `compile`.
        // The literal `s[3]` index also pins Task 2's end-to-end buffer-sizing
        // contract: `extractMaxLookback` recognises the `state.series`-bound
        // variable and folds `3` into `manifest.maxLookback`.
        const SERIES_SLOT = `
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";
const s = state.series(0);
export default defineIndicator({
    name: "series",
    apiVersion: 1,
    compute({ bar, ta, plot }) {
        s.value = bar.close * 2;
        const a = s[3];
        const b = +s;
        const e = ta.ema(s, 5); // proves the slot is accepted as a ta.* source
        plot(a + b + e[0]);
    },
});
`;
        // compile() throws a CompileError on any type error, so a successful
        // return already proves the full `state.series` surface type-checks.
        const result = await compile(SERIES_SLOT, {
            apiVersion: 1,
            sourcePath: "series.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
        // `s[3]` sized the series ring buffer to retain at least 4 slots.
        expect(result.manifest.maxLookback).toBeGreaterThanOrEqual(3);
    });

    it("type-checks a state.array bounded collection through the ambient shim", async () => {
        // `state.array<number>(20)` returns a `MutableArraySlot<number>` — a
        // bounded FIFO collection handle (`push`/`get`/`last`/`size`/`capacity`/
        // `clear`), NOT a number-coercible slot. `transformAndAnalyse`
        // (analysis-only) does not type-check, so this guard — which proves the
        // shim's `StateNamespace.array` signature and `MutableArraySlot` alias
        // are correct — must go through `compile`. The in-loop `win.get(i)` is a
        // method call on a value, NOT a registry callsite, so it must NOT trip
        // `stateful-call-inside-loop` — this test pins that too.
        // The `for` bound is the literal `20` (a bounded loop the compiler
        // accepts) and the body calls `win.get(i)` — a method call on a value,
        // NOT a registry callsite — so it exercises that the in-loop ban does
        // not fire for the collection read surface.
        const ARRAY_SLOT = `
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";
const win = state.array<number>(20);
export default defineIndicator({
    name: "array",
    apiVersion: 1,
    compute({ bar, plot }) {
        win.push(bar.close * 2);
        let sum = 0;
        let n = 0;
        for (let i = 0; i < 20; i++) {
            if (i < win.size) {
                sum += win.get(i);
                n += 1;
            }
        }
        plot(n > 0 ? sum / n : 0);
    },
});
`;
        // compile() throws a CompileError on any type/analysis error, so a
        // successful return proves both that the shim retyping is correct and
        // that the in-loop `.get(i)` method call did not trip the in-loop ban.
        const result = await compile(ARRAY_SLOT, {
            apiVersion: 1,
            sourcePath: "array.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("type-checks a state.map keyed collection through the ambient shim", async () => {
        // `state.map<number, number>(50)` returns a `MutableMapSlot<number,
        // number>` — a bounded keyed store (`set`/`get`/`has`/`delete`/`keyAt`/
        // `size`/`clear`), NOT a number-coercible slot. `transformAndAnalyse`
        // (analysis-only) does not type-check, so this guard — proving the
        // shim's `StateNamespace.map` signature and `MutableMapSlot` alias are
        // correct — must go through `compile`. The in-loop `m.keyAt(i)` /
        // `m.get(k)` are method calls on a value, NOT registry callsites, so
        // they must NOT trip `stateful-call-inside-loop`; the literal `50` for
        // bound pins that the bounded-loop walk over `m.size` is accepted.
        const MAP_SLOT = `
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";
const levels = state.map<number, number>(50);
export default defineIndicator({
    name: "map",
    apiVersion: 1,
    compute({ bar, plot }) {
        const key = Math.round(bar.close);
        levels.set(key, (levels.get(key) ?? 0) + 1);
        let total = 0;
        for (let i = 0; i < 50; i++) {
            if (i < levels.size) {
                const k = levels.keyAt(i);
                if (k !== undefined) total += levels.get(k) ?? 0;
            }
        }
        plot(levels.has(key) ? total : Number.NaN);
    },
});
`;
        const result = await compile(MAP_SLOT, {
            apiVersion: 1,
            sourcePath: "map.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("type-checks the bgcolor/barcolor aliases through the ambient shim", async () => {
        // `bgcolor(color, opts?)` / `barcolor(color, opts?)` are top-level
        // Pine-ergonomic holes (`packages/core/src/plot/plot.ts`) that the
        // shim must mirror in lockstep — a per-bar color expression plus the
        // `{ transp }` opts on `bgcolor` and a bare color on `barcolor`.
        // `transformAndAnalyse` (analysis-only) does not type-check, so this
        // guard — proving the shim's `bgcolor`/`barcolor` signatures and the
        // `BgColorOpts`/`BarColorOpts` aliases match core — must go through
        // `compile`. A successful return already proves zero type diagnostics.
        const ALIASES = `
import { barcolor, bgcolor, defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "aliases",
    apiVersion: 1,
    compute({ bar }) {
        bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
        barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
    },
});
`;
        const result = await compile(ALIASES, {
            apiVersion: 1,
            sourcePath: "aliases.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("type-checks the destructured ctx.bgcolor/ctx.barcolor through the shim ComputeContext", async () => {
        // The runtime binds bgcolor/barcolor on ComputeContext, so the shim's
        // ComputeContext must carry both fields (in lockstep with core). This
        // proves the destructured `compute({ bgcolor, barcolor })` form type-
        // checks — distinct from the imported-symbol form above.
        const ALIASES = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ctx-aliases",
    apiVersion: 1,
    compute({ bar, bgcolor, barcolor }) {
        bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
        barcolor("#a855f7", { title: "tint" });
    },
});
`;
        const result = await compile(ALIASES, {
            apiVersion: 1,
            sourcePath: "ctx-aliases.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("type-checks the time.* / session.* namespaces through the ambient shim", async () => {
        // The runtime installs frozen `time` / `session` namespaces on
        // ComputeContext (Tasks 2/4), so the shim must mirror core's
        // `TimeNamespace` / `SessionNamespace` in lockstep. `transformAndAnalyse`
        // (analysis-only) does not type-check, so this guard — proving the
        // shim's signatures match core, including the optional `tz` arg,
        // `time.timeClose`, and `time.now` — must go through `compile`. A successful return
        // already proves zero type diagnostics.
        const CALENDAR = `
import { defineIndicator, session, syminfo, time } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "calendar",
    apiVersion: 1,
    compute({ bar, plot }) {
        const dow = time.dayofweek(bar.time);
        const hh = time.hour(bar.time, syminfo.timezone);
        const close = time.timeClose(bar.time);
        const live = time.now();
        const open = session.isOpen(bar.time, "0930-1600");
        plot(open && dow >= 2 ? bar.close + hh + close + live : Number.NaN);
    },
});
`;
        const result = await compile(CALENDAR, {
            apiVersion: 1,
            sourcePath: "calendar.chart.ts",
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("throws CompileError for a non-literal state.array capacity", async () => {
        // End-to-end guard: a runtime-valued capacity breaks the
        // bounded-snapshot invariant and must error at the compiler boundary
        // with `state-array-capacity-not-literal` (Task 3).
        const source = `
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "dyn cap",
    apiVersion: 1,
    compute({ bar, plot }) {
        let len = 20;
        const win = state.array<number>(len);
        win.push(bar.close);
        plot(win.size);
    },
});
`;
        try {
            await compile(source, { apiVersion: 1, sourcePath: "dyn-cap.chart.ts" });
            expect.unreachable("compile should have thrown a CompileError");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(
                compileError.diagnostics.some((d) => d.code === "state-array-capacity-not-literal"),
            ).toBe(true);
        }
    });

    it("throws CompileError for a non-literal state.map capacity", async () => {
        // End-to-end guard: `state.map` rides the same literal-capacity pass as
        // `state.array`, so a runtime-valued capacity errors at the compiler
        // boundary with the shared `state-array-capacity-not-literal` code.
        const source = `
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "dyn map cap",
    apiVersion: 1,
    compute({ bar, plot }) {
        let cap = 50;
        const m = state.map<number, number>(cap);
        m.set(Math.round(bar.close), 1);
        plot(m.size);
    },
});
`;
        try {
            await compile(source, { apiVersion: 1, sourcePath: "dyn-map-cap.chart.ts" });
            expect.unreachable("compile should have thrown a CompileError");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(
                compileError.diagnostics.some((d) => d.code === "state-array-capacity-not-literal"),
            ).toBe(true);
        }
    });

    it("throws CompileError for a non-literal request.security symbol", async () => {
        // End-to-end guard: a runtime-valued symbol cannot be pre-enumerated
        // into `requestedFeeds`, so it must error at the compiler boundary with
        // `request-security-symbol-not-literal` (mirrors the interval rule).
        const source = `
import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";
declare const s: string;
export default defineIndicator({
    name: "dyn sym",
    apiVersion: 1,
    compute({ plot, request }) {
        const feed = request.security({ symbol: s, interval: "1D" });
        plot(feed.close.current);
    },
});
`;
        try {
            await compile(source, { apiVersion: 1, sourcePath: "dyn-sym.chart.ts" });
            expect.unreachable("compile should have thrown a CompileError");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(
                compileError.diagnostics.some(
                    (d) => d.code === "request-security-symbol-not-literal",
                ),
            ).toBe(true);
        }
    });

    it("throws CompileError with a `type-error` diagnostic when a TS semantic error fires", async () => {
        // Regression for the gap reported in PLAN §5.2 step 1: semantic
        // type errors (`const x: number = "oops"`) previously slipped
        // through silently. The fix wires `program.getSemanticDiagnostics`
        // into the pipeline under the `type-error` code.
        const TYPE_ERR = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "T",
    apiVersion: 1,
    compute({ bar, plot }) {
        const x: number = "oops";
        plot(x);
        void bar;
    },
});
`;
        try {
            await compile(TYPE_ERR, { apiVersion: 1, sourcePath: "demo.chart.ts" });
            expect.unreachable("compile should have thrown a CompileError");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            const first = compileError.diagnostics[0];
            expect(first?.code).toBe("type-error");
            expect(first?.severity).toBe("error");
            expect(first?.file).toBe("demo.chart.ts");
            expect(first?.line).toBe(7);
            expect(first?.message).toContain("TS2322");
        }
    });

    it("throws CompileError carrying the diagnostic array when Math.random is used", async () => {
        await expect(() =>
            compile(HOSTILE, { apiVersion: 1, sourcePath: "bad.chart.ts" }),
        ).rejects.toBeInstanceOf(CompileError);
        try {
            await compile(HOSTILE, { apiVersion: 1, sourcePath: "bad.chart.ts" });
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(compileError.diagnostics[0]?.code).toBe("hostile-global");
            expect(compileError.name).toBe("CompileError");
            expect(compileError.message).toContain("hostile-global");
        }
    });

    it("throws CompileError for lower-tf-not-lower when declaredIntervals are supplied", async () => {
        const source = `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ltf too high",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: "1D" });
    },
});
`;
        try {
            await compile(source, {
                apiVersion: 1,
                sourcePath: "ltf.chart.ts",
                declaredIntervals: [{ value: "1m", label: "1 minute", group: "minute" }],
            });
            expect.unreachable("compile should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            expect((err as CompileError).diagnostics[0]?.code).toBe("lower-tf-not-lower");
        }
    });

    it("throws CompileError for non-literal input defaults", async () => {
        const source = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const len = 14;
export default defineIndicator({
    name: "bad inputs",
    apiVersion: 1,
    inputs: { len: input.int(len) },
    compute: () => {},
});
`;
        await expect(() =>
            compile(source, { apiVersion: 1, sourcePath: "bad-inputs.chart.ts" }),
        ).rejects.toBeInstanceOf(CompileError);
        try {
            await compile(source, { apiVersion: 1, sourcePath: "bad-inputs.chart.ts" });
        } catch (err) {
            expect(err).toBeInstanceOf(CompileError);
            const compileError = err as CompileError;
            expect(compileError.diagnostics[0]?.code).toBe("input-default-not-literal");
        }
    });

    it("produces byte-identical moduleSource on repeat compiles (determinism)", async () => {
        const a = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        const b = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(a.moduleSource).toBe(b.moduleSource);
        expect(a.types).toBe(b.types);
    });

    it("defaults sourcePath to script.chart.ts when omitted", async () => {
        const result = await compile(VALID_DEFINE, { apiVersion: 1 });
        expect(result.manifest.name).toBe("demo");
    });

    it("supports inline sourcemaps", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            sourcemap: "inline",
        });
        expect(result.moduleSource).toContain("sourceMappingURL=data:application/json;base64,");
        expect(result.sourcemap).toBeUndefined();
    });

    it("supports external sourcemaps", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            sourcemap: "external",
        });
        expect(result.sourcemap).toBeTypeOf("string");
    });

    it("supports minification", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
            minify: true,
        });
        expect(result.moduleSource.length).toBeGreaterThan(0);
    });

    it("builds an empty CompileError message when given an empty diagnostic array", () => {
        const error = new CompileError([]);
        expect(error.message).toBe("Compilation failed");
        expect(error.diagnostics).toEqual([]);
    });

    it("produces a self-contained bundle with no `import` statements (data: URL ready)", async () => {
        // §5.2 contract: the compile output bundles `@invinite-org/chartlang-core`
        // and tree-shakes. Hosts load via `data:text/javascript` URLs which
        // cannot resolve bare specifiers — any surviving import line breaks
        // every browser worker + QuickJS load path.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
        expect(result.moduleSource).not.toContain("@invinite-org/chartlang-core");
        // The PLAN §5.2 budget for unminified output is ~5–50 KB; a leaked
        // `defineIndicator` body would not fit under the upper bound.
        expect(result.moduleSource.length).toBeGreaterThan(1_000);
        expect(result.moduleSource.length).toBeLessThan(60_000);
    });

    it("the real examples/scripts/ema-cross.chart.ts bundle is between 5KB and 50KB per PLAN §5.2", async () => {
        const realSrc = await readFile(
            new URL("../../../examples/scripts/ema-cross.chart.ts", import.meta.url),
            "utf8",
        );
        const result = await compile(realSrc, {
            apiVersion: 1,
            sourcePath: "examples/scripts/ema-cross.chart.ts",
        });
        // PLAN §5.2: compiled output is ~5-50 KB. Bundling pulls in core's
        // `defineIndicator` stub + supporting runtime shims; the bundled
        // size should land inside that envelope, while the previous
        // transform-only path produced ~1.3 KB (broken at runtime).
        expect(result.moduleSource.length).toBeGreaterThan(5_000);
        expect(result.moduleSource.length).toBeLessThan(50_000);
        expect(result.moduleSource).not.toMatch(/^\s*import\b/m);
    });

    it("the bundled output loads as an ES module via a data: URL and exposes a `default`", async () => {
        // This is the worker host (`createWorkerBoot.ts`'s `importCompiledModule`)
        // path simulated end-to-end: compile a real script, encode as a
        // `data:text/javascript;charset=utf-8,...` URL, dynamically `import` it,
        // and assert the default export is a callable `compute`.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(result.moduleSource)}`;
        const mod = (await import(/* @vite-ignore */ dataUrl)) as {
            readonly default: { readonly compute: (...args: unknown[]) => unknown };
            readonly __manifest: { readonly name: string };
        };
        expect(typeof mod.default).toBe("object");
        expect(typeof mod.default.compute).toBe("function");
        expect(mod.__manifest.name).toBe("EMA cross");
    });

    it("carries the real manifest on `default` — deep-equals `__manifest`, not the zeroed stub", async () => {
        // The footgun this closes: a compiled `mod.default` fed straight into
        // `createScriptRunner` must carry the compiler-derived manifest, not the
        // author stub (`maxLookback: 0`) that collapses series capacity to 1.
        const src = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Lookback",
    apiVersion: 1,
    compute: ({ bar, plot }) => {
        plot(bar.close[5]);
    },
});`;
        const result = await compile(src, { apiVersion: 1, sourcePath: "lookback.chart.ts" });
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(result.moduleSource)}`;
        const mod = (await import(/* @vite-ignore */ dataUrl)) as {
            readonly default: {
                readonly manifest: { readonly maxLookback: number };
                readonly compute: unknown;
            };
            readonly __manifest: unknown;
        };
        // The default's manifest equals the sidecar (deep, not identity), so the
        // real `bar.close[5]` lookback (5, not the stub's 0) rides the default.
        expect(mod.default.manifest).toEqual(mod.__manifest);
        expect(mod.default.manifest.maxLookback).toBe(5);
        expect(typeof mod.default.compute).toBe("function");
        expect(Object.isFrozen(mod.default)).toBe(true);
    });

    it("compiles a defineDrawing script with manifest.kind 'drawing' and capabilities ['drawings']", async () => {
        const DRAWING_SCRIPT = `
import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({
    name: "fib-tool",
    apiVersion: 1,
    compute: ({ draw }) => {
        draw.horizontalLine(100);
    },
});
`;
        const result = await compile(DRAWING_SCRIPT, {
            apiVersion: 1,
            sourcePath: "fib-tool.chart.ts",
        });
        expect(result.manifest.kind).toBe("drawing");
        expect(result.manifest.name).toBe("fib-tool");
        expect(result.manifest.capabilities).toEqual(["drawings"]);
    });

    it("emits a multi-export bundle with an indented manifest array tail", async () => {
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        // Default manifest carries the `siblings` field so the runtime
        // can mount the named exports alongside it.
        expect(result.manifest.exportName).toBe("default");
        expect(result.manifest.isDrawn).toBe(true);
        expect(result.manifest.siblings).toBeDefined();
        expect(result.manifest.siblings).toHaveLength(1);
        expect(result.moduleSource).toContain("__chartlang_depOutput");
        expect(result.moduleSource).toContain('"exportName": "default"');
        expect(result.moduleSource).toContain('"exportName": "sibling"');
    });

    it("emits a `__dependencies` export when the default manifest declares private deps", async () => {
        // Task 6 contract: hosts read `mod.__dependencies` to discover
        // every private dep and mount it as a `DepRunner`. The export
        // is prepended to the pre-bundle source (via
        // {@link formatDependenciesAssignment}) so esbuild keeps each
        // dep binding alive in the tree-shake — withInputs-derived
        // cross-file aliases reduce to bare references that the
        // tree-shaker would otherwise drop. After bundling esbuild
        // re-emits the export through the standard
        // `export { __dependencies, ... };` namespace block.
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        expect(result.moduleSource).toMatch(/var __dependencies = \[/);
        expect(result.moduleSource).toMatch(/export\s*\{[^}]*__dependencies/);
        expect(result.moduleSource).toContain('localId: "base"');
        expect(result.moduleSource).toContain("compiled: base");
    });

    it("omits `__dependencies` for single-script files (back-compat byte-identity)", async () => {
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toContain("__dependencies");
    });

    it("bakes each producer's titled outputs onto its defineIndicator call so the runtime self-describes", async () => {
        // Phase-7 composition fix: every producer the runtime mounts
        // (private dep + named-export sibling) must carry
        // `outputs: [...]` on its define-call so `manifest.outputs` is
        // populated and the host allocates a dep-output ring buffer.
        const result = await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "multi.chart.ts",
        });
        expect(result.moduleSource).toMatch(
            /name: "Base"[\s\S]*?outputs: \[\{ title: "line", kind: "series-number" \}\]/,
        );
        expect(result.moduleSource).toMatch(
            /name: "Sibling"[\s\S]*?outputs: \[\{ title: "echo", kind: "series-number" \}\]/,
        );
    });

    it("leaves a titled single-export script's outputs out of the bundle body when nothing consumes it untitled-only", async () => {
        // EMA_CROSS plots `fast` untitled, so the default has zero
        // titled outputs ⇒ no injection ⇒ no `outputs:` in the body.
        const result = await compile(EMA_CROSS, {
            apiVersion: 1,
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.moduleSource).not.toMatch(/outputs: \[\{ title:/);
    });

    it("compiles a cross-file consumer + producer via the default resolver and bakes the alias overrides into __dependencies", async () => {
        // Exercises `compile()`'s default cross-file resolver path —
        // no explicit `resolveProducer`, no `compileProject` driving
        // the recursion. The consumer's `baseTrend.withInputs({...})`
        // alias must reduce to a bare reference (so the runtime
        // sentinel never fires) and the merged effective inputs must
        // appear inside `__dependencies[i].inputOverrides`.
        const dir = await mkdtemp(join(tmpdir(), "chartlang-compile-xfile-"));
        try {
            const producerSource = `import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "cross-file producer",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(14, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), { title: "line" });
    },
});`;
            const consumerSource = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
const trend = baseTrend.withInputs({ length: 30 });
export default defineIndicator({
    name: "cross-file consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const value = trend.output("line").current;
        plot(value - bar.close, { title: "gap" });
    },
});`;
            await writeFile(join(dir, "base-trend.chart.ts"), producerSource, "utf8");
            const consumerPath = join(dir, "consumer.chart.ts");
            await writeFile(consumerPath, consumerSource, "utf8");
            const result = await compile(consumerSource, {
                apiVersion: 1,
                sourcePath: consumerPath,
            });
            // The producer is inlined as a self-contained IIFE.
            expect(result.moduleSource).toMatch(/__producer_[0-9a-f]+__default/);
            // The withInputs chain has been collapsed away.
            expect(result.moduleSource).not.toMatch(/baseTrend\.withInputs/);
            expect(result.moduleSource).toMatch(/var trend = baseTrend;/);
            // The merged effective inputs flow through __dependencies.
            expect(result.moduleSource).toMatch(/inputOverrides:\s*\{[^}]*"length":\s*30/);
            // The output accessor is rewritten to the runtime helper.
            expect(result.moduleSource).toContain("__chartlang_depOutput(");
            expect(result.moduleSource).toContain('"trend"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("resolves a sibling `.chart` import from `inMemoryChartSources` with nothing on disk", async () => {
        // The single-source host path (the demo's `/api/compile`): no
        // producer file on disk — the `./base-trend.chart` import is
        // satisfied entirely from the in-memory source map keyed by the
        // specifier as written. Without it the compile would fail with
        // `TS2307: Cannot find module './base-trend.chart'` + `dep-dynamic`.
        const producerSource = `import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "in-memory producer",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(14, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), { title: "line" });
    },
});`;
        const consumerSource = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
export default defineIndicator({
    name: "in-memory consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        plot(baseTrend.output("line").current, { title: "imported" });
    },
});`;
        const result = await compile(consumerSource, {
            apiVersion: 1,
            sourcePath: "demo.chart.ts",
            inMemoryChartSources: { "./base-trend.chart": producerSource },
        });
        // The in-memory producer was inlined as a self-contained IIFE and the
        // cross-file dependency was recorded against the `./base-trend.chart`
        // specifier — proof the cross-file resolve + dependency analysis ran
        // off the in-memory map (and that the typecheck did not TS2307).
        expect(result.moduleSource).toMatch(/__producer_[0-9a-f]+__default/);
        expect(result.moduleSource).toContain('"producerSourcePath":"./base-trend.chart"');
        expect(result.moduleSource).toContain('"title":"line"');
    });
});
