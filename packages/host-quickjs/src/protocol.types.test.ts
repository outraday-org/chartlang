// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    HostCompiledScript,
    HostToWorker,
    WorkerToHost,
} from "@invinite-org/chartlang-host-worker";
import { describe, expectTypeOf, it } from "vitest";

import type { HostToQuickJs, QuickJsToHost } from "./protocol.js";
import type { QuickJsCompiledScript, QuickJsHostLimits } from "./types.js";

describe("HostToQuickJs", () => {
    it("uses the host-worker frame discriminants", () => {
        expectTypeOf<HostToQuickJs["kind"]>().toEqualTypeOf<HostToWorker["kind"]>();
    });

    it("mirrors non-load host-worker frames byte-for-byte", () => {
        type QuickFrames = Exclude<HostToQuickJs, { kind: "load" }>;
        type WorkerFrames = Exclude<HostToWorker, { kind: "load" }>;
        expectTypeOf<QuickFrames>().toEqualTypeOf<WorkerFrames>();
    });

    it("load carries the host-worker fields with QuickJS limits", () => {
        type Load = Extract<HostToQuickJs, { kind: "load" }>;
        expectTypeOf<Load["compiled"]>().toEqualTypeOf<QuickJsCompiledScript>();
        expectTypeOf<Load["compiled"]>().toEqualTypeOf<HostCompiledScript>();
        expectTypeOf<Load["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<Load["symInfo"]>().toEqualTypeOf<AdapterSymInfo | undefined>();
        expectTypeOf<Load["inputOverrides"]>().toEqualTypeOf<
            Readonly<Record<string, unknown>> | undefined
        >();
        expectTypeOf<Load["limits"]>().toEqualTypeOf<QuickJsHostLimits>();
    });

    it("candleEvent carries the adapter-kit CandleEvent", () => {
        type Frame = Extract<HostToQuickJs, { kind: "candleEvent" }>;
        expectTypeOf<Frame["event"]>().toEqualTypeOf<CandleEvent>();
    });

    it("rejects malformed frames", () => {
        // @ts-expect-error nonce must stay numeric.
        const invalidDrain: HostToQuickJs = { kind: "drain", nonce: "bad" };
        void invalidDrain;
    });
});

describe("QuickJsToHost", () => {
    it("mirrors WorkerToHost byte-for-byte", () => {
        expectTypeOf<QuickJsToHost>().toEqualTypeOf<WorkerToHost>();
    });

    it("emissions carries the host's nonce and RunnerEmissions", () => {
        type Frame = Extract<QuickJsToHost, { kind: "emissions" }>;
        expectTypeOf<Frame["nonce"]>().toEqualTypeOf<number>();
        expectTypeOf<Frame["emissions"]>().toEqualTypeOf<RunnerEmissions>();
    });
});
