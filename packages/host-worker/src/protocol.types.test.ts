// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    DiagnosticCode,
    RunnerEmissions,
    RuntimeDiagnostic,
    ExternalSeriesFeedMap,
} from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostCompiledScript, HostLimits } from "./types.js";

describe("HostToWorker", () => {
    it("is a discriminated union over `kind`", () => {
        expectTypeOf<HostToWorker["kind"]>().toEqualTypeOf<
            "load" | "candleEvent" | "setPlotOverrides" | "setExternalSeries" | "drain" | "dispose"
        >();
    });

    it("load carries compiled / capabilities / sym-info / limits", () => {
        type Load = Extract<HostToWorker, { kind: "load" }>;
        expectTypeOf<Load["compiled"]>().toEqualTypeOf<HostCompiledScript>();
        expectTypeOf<Load["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<Load["symInfo"]>().toEqualTypeOf<AdapterSymInfo | undefined>();
        expectTypeOf<Load["externalSeriesFeeds"]>().toEqualTypeOf<
            ExternalSeriesFeedMap | undefined
        >();
        expectTypeOf<Load["limits"]>().toEqualTypeOf<HostLimits>();
    });

    it("candleEvent carries the adapter-kit CandleEvent", () => {
        type Frame = Extract<HostToWorker, { kind: "candleEvent" }>;
        expectTypeOf<Frame["event"]>().toEqualTypeOf<CandleEvent>();
    });

    it("drain carries a numeric nonce", () => {
        type Frame = Extract<HostToWorker, { kind: "drain" }>;
        expectTypeOf<Frame["nonce"]>().toEqualTypeOf<number>();
    });

    it("setExternalSeries carries a complete feed map", () => {
        type Frame = Extract<HostToWorker, { kind: "setExternalSeries" }>;
        expectTypeOf<Frame["feeds"]>().toEqualTypeOf<ExternalSeriesFeedMap>();
    });
});

describe("WorkerToHost", () => {
    it("is a discriminated union over `kind`", () => {
        expectTypeOf<WorkerToHost["kind"]>().toEqualTypeOf<
            "loaded" | "loadError" | "emissions" | "step-overshoot" | "fatal"
        >();
    });

    it("emissions carries the host's nonce + RunnerEmissions", () => {
        type Frame = Extract<WorkerToHost, { kind: "emissions" }>;
        expectTypeOf<Frame["nonce"]>().toEqualTypeOf<number>();
        expectTypeOf<Frame["emissions"]>().toEqualTypeOf<RunnerEmissions>();
    });

    it("step-overshoot does not carry a nonce", () => {
        type Frame = Extract<WorkerToHost, { kind: "step-overshoot" }>;
        expectTypeOf<Frame>().toEqualTypeOf<{
            readonly kind: "step-overshoot";
            readonly observedMs: number;
        }>();
    });
});

describe("HostCompiledScript", () => {
    it("pins moduleSource + manifest", () => {
        expectTypeOf<HostCompiledScript["moduleSource"]>().toEqualTypeOf<string>();
        expectTypeOf<HostCompiledScript["manifest"]>().toEqualTypeOf<ScriptManifest>();
    });
});

describe("RuntimeDiagnostic — Phase-7 dep-* codes", () => {
    // §22.10 indicator-composition: the host-worker round-trips every
    // `dep-*` diagnostic code through the postMessage wire (structured
    // clone of `RunnerEmissions.diagnostics`). The type-level coverage
    // here pins the contract so a future narrowing of the union breaks
    // the build instead of silently dropping codes.
    it("accepts `dep-error`", () => {
        const code: DiagnosticCode = "dep-error";
        const d: RuntimeDiagnostic = {
            kind: "diagnostic",
            severity: "error",
            code,
            message: "boom",
            slotId: "dep:trend/inner:1:1#0",
            bar: 3,
        };
        expectTypeOf(d.code).toMatchTypeOf<DiagnosticCode>();
    });

    it("accepts `dep-cycle`", () => {
        const code: DiagnosticCode = "dep-cycle";
        expectTypeOf(code).toMatchTypeOf<DiagnosticCode>();
    });

    it("accepts `dep-unknown-output`", () => {
        const code: DiagnosticCode = "dep-unknown-output";
        expectTypeOf(code).toMatchTypeOf<DiagnosticCode>();
    });

    it("accepts `dep-invalid-input-override`", () => {
        const code: DiagnosticCode = "dep-invalid-input-override";
        expectTypeOf(code).toMatchTypeOf<DiagnosticCode>();
    });

    it("accepts `dep-dynamic`", () => {
        const code: DiagnosticCode = "dep-dynamic";
        expectTypeOf(code).toMatchTypeOf<DiagnosticCode>();
    });

    it("accepts `dep-output-not-titled`", () => {
        const code: DiagnosticCode = "dep-output-not-titled";
        expectTypeOf(code).toMatchTypeOf<DiagnosticCode>();
    });
});

describe("WorkerToHost.emissions — dep-* round-trip via structuredClone", () => {
    // structuredClone is the postMessage wire boundary. Any field that
    // survives the clone survives the worker boundary. Pin every Phase-7
    // `dep-*` code with the wider-message smoke test from task §3.
    const depCodes = [
        "dep-error",
        "dep-cycle",
        "dep-unknown-output",
        "dep-invalid-input-override",
        "dep-dynamic",
        "dep-output-not-titled",
    ] as const;
    for (const code of depCodes) {
        it(`round-trips a '${code}' diagnostic byte-identically`, () => {
            const dx: RuntimeDiagnostic = {
                kind: "diagnostic",
                severity: "error",
                code,
                message: "boom",
                slotId: "dep:trend/inner-slot:1:1#0",
                bar: 3,
            };
            expect(structuredClone(dx)).toEqual(dx);
        });
    }
});
