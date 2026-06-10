// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultWorkerFactory } from "./defaultWorkerFactory.js";

describe("defaultWorkerFactory", () => {
    const original = Reflect.has(globalThis, "Worker")
        ? (globalThis as { Worker?: unknown }).Worker
        : undefined;
    const hadOriginal = Reflect.has(globalThis, "Worker");

    afterEach(() => {
        if (hadOriginal) {
            (globalThis as { Worker?: unknown }).Worker = original;
        } else {
            Reflect.deleteProperty(globalThis as object, "Worker");
        }
    });

    it("constructs a Worker against the bundled worker-boot.js URL", () => {
        const ctor = vi.fn(function FakeWorker(this: object, url: URL, opts: WorkerOptions) {
            Object.assign(this, { url, opts });
        });
        (globalThis as { Worker?: unknown }).Worker = ctor;

        const worker = defaultWorkerFactory();

        expect(ctor).toHaveBeenCalledOnce();
        const [urlArg, optsArg] = ctor.mock.calls[0];
        expect(urlArg).toBeInstanceOf(URL);
        expect((urlArg as URL).href.endsWith("worker-boot.js")).toBe(true);
        expect(optsArg).toEqual({ type: "module" });
        expect(worker).toBeDefined();
    });

    it("throws when the host has no `Worker` global (e.g. plain Node)", () => {
        Reflect.deleteProperty(globalThis as object, "Worker");
        expect(() => defaultWorkerFactory()).toThrow();
    });
});
