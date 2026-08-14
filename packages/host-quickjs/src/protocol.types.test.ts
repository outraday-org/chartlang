// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { SessionCalendarDay, StateStoreKey } from "@invinite-org/chartlang-core";
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

    it("mirrors the snapshot identity on load but NOT the persistence descriptor", () => {
        type Load = Extract<HostToQuickJs, { kind: "load" }>;
        expectTypeOf<Load["stateStoreKey"]>().toEqualTypeOf<StateStoreKey | undefined>();
        // IndexedDB does not exist in the QuickJS realm — automatic
        // persistence is a host-worker-only affordance.
        expectTypeOf<Load>().not.toHaveProperty("persistence");
    });

    it("mirrors the optional exchange-calendar rows on load", () => {
        type Load = Extract<HostToQuickJs, { kind: "load" }>;
        expectTypeOf<Load["sessionCalendar"]>().toEqualTypeOf<
            ReadonlyArray<SessionCalendarDay> | undefined
        >();
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
    it("carries every WorkerToHost arm, plus the QuickJS-only `ack`", () => {
        // Not `toEqualTypeOf`: this union deliberately adds `ack` (the
        // empty-success reply for push / dispose, which the worker host has no
        // need for). Every host-worker arm must still be assignable in, which
        // is what keeps drain / load / snapshot / overshoot / fatal handling
        // shareable across the two hosts.
        expectTypeOf<WorkerToHost>().toMatchTypeOf<QuickJsToHost>();
        expectTypeOf<Exclude<QuickJsToHost["kind"], WorkerToHost["kind"]>>().toEqualTypeOf<"ack">();
    });

    it("mirrors the snapshot reply arms", () => {
        type Snapshot = Extract<QuickJsToHost, { kind: "snapshot" }>;
        expectTypeOf<Snapshot>().toEqualTypeOf<Extract<WorkerToHost, { kind: "snapshot" }>>();
        type Imported = Extract<QuickJsToHost, { kind: "snapshotImported" }>;
        expectTypeOf<Imported>().toEqualTypeOf<
            Extract<WorkerToHost, { kind: "snapshotImported" }>
        >();
        type Failed = Extract<QuickJsToHost, { kind: "snapshotError" }>;
        expectTypeOf<Failed>().toEqualTypeOf<Extract<WorkerToHost, { kind: "snapshotError" }>>();
    });

    it("emissions carries the host's nonce and RunnerEmissions", () => {
        type Frame = Extract<QuickJsToHost, { kind: "emissions" }>;
        expectTypeOf<Frame["nonce"]>().toEqualTypeOf<number>();
        expectTypeOf<Frame["emissions"]>().toEqualTypeOf<RunnerEmissions>();
    });
});
