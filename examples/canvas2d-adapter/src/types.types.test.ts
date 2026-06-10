// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Adapter,
    AlertEmission,
    CandleEvent,
    Capabilities,
} from "@invinite-org/chartlang-adapter-kit";
import type { ScriptHost, WorkerLike } from "@invinite-org/chartlang-host-worker";
import { describe, expectTypeOf, it } from "vitest";

import {
    createCanvas2dAdapter,
    runRendererLoop,
    type Canvas2dAdapterHandle,
    type CreateCanvas2dAdapterOpts,
} from "./createCanvas2dAdapter.js";
import type { Palette } from "./palette.js";

describe("createCanvas2dAdapter", () => {
    it("returns Adapter & { readonly host: ScriptHost }", () => {
        expectTypeOf(createCanvas2dAdapter).returns.toEqualTypeOf<Canvas2dAdapterHandle>();
        expectTypeOf<Canvas2dAdapterHandle>().toMatchTypeOf<Adapter>();
        expectTypeOf<Canvas2dAdapterHandle["host"]>().toEqualTypeOf<ScriptHost>();
    });

    it("accepts CreateCanvas2dAdapterOpts", () => {
        expectTypeOf(createCanvas2dAdapter).parameter(0).toEqualTypeOf<CreateCanvas2dAdapterOpts>();
    });

    it("CreateCanvas2dAdapterOpts surfaces every documented field", () => {
        expectTypeOf<CreateCanvas2dAdapterOpts["candleSource"]>().toEqualTypeOf<
            AsyncIterable<CandleEvent>
        >();
        expectTypeOf<CreateCanvas2dAdapterOpts["capabilities"]>().toEqualTypeOf<
            Capabilities | undefined
        >();
        expectTypeOf<CreateCanvas2dAdapterOpts["interval"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<CreateCanvas2dAdapterOpts["palette"]>().toEqualTypeOf<Palette | undefined>();
        expectTypeOf<CreateCanvas2dAdapterOpts["onAlert"]>().toEqualTypeOf<
            ((a: AlertEmission) => void) | undefined
        >();
        expectTypeOf<CreateCanvas2dAdapterOpts["host"]>().toEqualTypeOf<ScriptHost | undefined>();
        expectTypeOf<CreateCanvas2dAdapterOpts["workerLike"]>().toEqualTypeOf<
            WorkerLike | undefined
        >();
    });
});

describe("runRendererLoop", () => {
    it("takes a Canvas2dAdapterHandle and returns Promise<void>", () => {
        expectTypeOf(runRendererLoop).parameter(0).toEqualTypeOf<Canvas2dAdapterHandle>();
        expectTypeOf(runRendererLoop).returns.toEqualTypeOf<Promise<void>>();
    });
});
