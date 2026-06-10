// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expectTypeOf, it } from "vitest";

import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostCompiledScript, HostLimits } from "./types.js";

describe("HostToWorker", () => {
    it("is a discriminated union over `kind`", () => {
        expectTypeOf<HostToWorker["kind"]>().toEqualTypeOf<
            "load" | "candleEvent" | "drain" | "dispose"
        >();
    });

    it("load carries compiled / capabilities / sym-info / limits", () => {
        type Load = Extract<HostToWorker, { kind: "load" }>;
        expectTypeOf<Load["compiled"]>().toEqualTypeOf<HostCompiledScript>();
        expectTypeOf<Load["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<Load["symInfo"]>().toEqualTypeOf<AdapterSymInfo | undefined>();
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
