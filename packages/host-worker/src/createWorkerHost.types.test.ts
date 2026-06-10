// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import { describe, expectTypeOf, it } from "vitest";

import { createWorkerHost, type CreateWorkerHostOpts } from "./createWorkerHost.js";
import type { HostCompiledScript, HostLimits, ScriptHost, WorkerLike } from "./types.js";

describe("createWorkerHost", () => {
    it("returns a ScriptHost", () => {
        expectTypeOf(createWorkerHost).returns.toEqualTypeOf<ScriptHost>();
    });

    it("accepts CreateWorkerHostOpts", () => {
        expectTypeOf(createWorkerHost).parameter(0).toEqualTypeOf<CreateWorkerHostOpts>();
    });

    it("CreateWorkerHostOpts exposes the documented fields", () => {
        expectTypeOf<CreateWorkerHostOpts["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<CreateWorkerHostOpts["symInfo"]>().toEqualTypeOf<AdapterSymInfo | undefined>();
        expectTypeOf<CreateWorkerHostOpts["workerLike"]>().toEqualTypeOf<WorkerLike | undefined>();
        expectTypeOf<CreateWorkerHostOpts["limits"]>().toEqualTypeOf<
            Partial<HostLimits> | undefined
        >();
        expectTypeOf<CreateWorkerHostOpts["onWorkerError"]>().toEqualTypeOf<
            ((message: string) => void) | undefined
        >();
    });
});

describe("ScriptHost", () => {
    it("load takes a HostCompiledScript and returns Promise<void>", () => {
        expectTypeOf<ScriptHost["load"]>().parameter(0).toEqualTypeOf<HostCompiledScript>();
        expectTypeOf<ScriptHost["load"]>().returns.toEqualTypeOf<Promise<void>>();
    });

    it("push takes a CandleEvent and returns Promise<void>", () => {
        expectTypeOf<ScriptHost["push"]>().parameter(0).toEqualTypeOf<CandleEvent>();
        expectTypeOf<ScriptHost["push"]>().returns.toEqualTypeOf<Promise<void>>();
    });

    it("drain returns Promise<RunnerEmissions>", () => {
        expectTypeOf<ScriptHost["drain"]>().returns.toEqualTypeOf<Promise<RunnerEmissions>>();
    });

    it("dispose returns void", () => {
        expectTypeOf<ScriptHost["dispose"]>().returns.toEqualTypeOf<void>();
    });

    it("limits is HostLimits", () => {
        expectTypeOf<ScriptHost["limits"]>().toEqualTypeOf<HostLimits>();
    });
});
