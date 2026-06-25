// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/program.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it, vi } from "vitest";

import { Program } from "./program.js";

type ProgramStubOptions = {
    compileOk: boolean;
    compileLog?: string;
    linkOk?: boolean;
    linkLog?: string;
};

// A stub `WebGL2RenderingContext` that records the compile/link/uniform
// call sequence so `Program` can be exercised headlessly in node — the
// raw `gl.*` driver is never touched (browser-only).
function makeStubGl(options: ProgramStubOptions): WebGL2RenderingContext {
    const linkOk = options.linkOk ?? true;

    const sentinelProgram = { kind: "program" };

    const stub = {
        attachShader: vi.fn(),
        COMPILE_STATUS: 0x8b81,
        compileShader: vi.fn(),
        createProgram: vi.fn(() => sentinelProgram),
        createShader: vi.fn((type: number) => ({ kind: "shader", type })),
        deleteProgram: vi.fn(),
        deleteShader: vi.fn(),
        FLOAT: 0x1406,
        FRAGMENT_SHADER: 0x8b30,
        getAttribLocation: vi.fn(() => 0),
        getProgramInfoLog: vi.fn(() => options.linkLog ?? ""),
        getProgramParameter: vi.fn(() => linkOk),
        getShaderInfoLog: vi.fn(() => options.compileLog ?? ""),
        getShaderParameter: vi.fn(() => options.compileOk),
        getUniformLocation: vi.fn((_program: unknown, name: string) => ({
            kind: "uniform-location",
            name,
        })),
        LINK_STATUS: 0x8b82,
        linkProgram: vi.fn(),
        shaderSource: vi.fn(),
        uniform1f: vi.fn(),
        uniform2f: vi.fn(),
        uniform4fv: vi.fn(),
        uniformMatrix3fv: vi.fn(),
        useProgram: vi.fn(),
        VERTEX_SHADER: 0x8b31,
    };

    return stub as unknown as WebGL2RenderingContext;
}

const VERTEX_SOURCE = "void main() { gl_Position = vec4(0.0); }";

const FRAGMENT_SOURCE = "void main() { gl_FragColor = vec4(1.0); }";

describe("Program", () => {
    it("constructs successfully when compile + link both succeed", () => {
        const gl = makeStubGl({ compileOk: true });

        const program = new Program(
            gl,
            VERTEX_SOURCE,
            FRAGMENT_SOURCE,
            ["aPos"],
            ["uColor", "uProj"],
        );

        expect(program.getAttribute("aPos").name).toBe("aPos");

        expect(program.getUniform("uColor").name).toBe("uColor");

        expect(program.getUniform("uProj").name).toBe("uProj");
    });

    it("skips a uniform whose location resolves to null (optimised out)", () => {
        const gl = makeStubGl({ compileOk: true });

        // Force getUniformLocation to return null for the unused uniform.
        const getUniformLocation = gl.getUniformLocation as unknown as ReturnType<typeof vi.fn>;

        getUniformLocation.mockImplementation((_program: unknown, name: string) =>
            name === "uUnused" ? null : { kind: "uniform-location", name },
        );

        const program = new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, [], ["uColor", "uUnused"]);

        expect(program.getUniform("uColor").name).toBe("uColor");

        expect(() => program.getUniform("uUnused")).toThrow(/uUnused/);
    });

    it("throws on shader compile failure with a message that contains the info log AND the source", () => {
        const sourceWithBug = "this is not valid glsl";

        const compileLog = "ERROR: 0:1: 'this' : syntax error";

        const gl = makeStubGl({ compileLog, compileOk: false });

        expect(() => new Program(gl, sourceWithBug, FRAGMENT_SOURCE, [], [])).toThrow(
            /syntax error/,
        );

        try {
            new Program(gl, sourceWithBug, FRAGMENT_SOURCE, [], []);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            expect(message).toContain(compileLog);

            expect(message).toContain("this is not valid glsl");

            // The numbered-source pass prefixes lines with `  1:` etc.
            expect(message).toMatch(/\s{2}1:/);
        }
    });

    it("throws on link failure with the program info log", () => {
        const gl = makeStubGl({ compileOk: true, linkLog: "varying mismatch", linkOk: false });

        expect(() => new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, [], [])).toThrow(
            /varying mismatch/,
        );
    });

    it("throws when an undeclared attribute is requested", () => {
        const gl = makeStubGl({ compileOk: true });

        const program = new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, ["aPos"], []);

        expect(() => program.getAttribute("aMissing")).toThrow(/aMissing/);
    });

    it("throws when an undeclared uniform is requested", () => {
        const gl = makeStubGl({ compileOk: true });

        const program = new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, [], ["uColor"]);

        expect(() => program.getUniform("uMissing")).toThrow(/uMissing/);
    });

    it("setUniform helpers route to the correct gl.uniform* call", () => {
        const gl = makeStubGl({ compileOk: true });

        const program = new Program(
            gl,
            VERTEX_SOURCE,
            FRAGMENT_SOURCE,
            [],
            ["uFloat", "uVec2", "uVec4", "uMat3"],
        );

        program.use();

        expect(gl.useProgram).toHaveBeenCalled();

        program.setUniform1f("uFloat", 0.5);

        expect(gl.uniform1f).toHaveBeenCalled();

        program.setUniform2f("uVec2", 1, 2);

        expect(gl.uniform2f).toHaveBeenCalled();

        const v4 = new Float32Array([1, 0, 0, 1]);

        program.setUniform4fv("uVec4", v4);

        expect(gl.uniform4fv).toHaveBeenCalled();

        const m3 = new Float32Array(9);

        program.setUniformMatrix3fv("uMat3", m3);

        expect(gl.uniformMatrix3fv).toHaveBeenCalled();
    });

    it("dispose deletes program + shaders and clears the binding cache", () => {
        const gl = makeStubGl({ compileOk: true });

        const program = new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, ["aPos"], ["uColor"]);

        program.dispose();

        expect(gl.deleteProgram).toHaveBeenCalled();

        expect(gl.deleteShader).toHaveBeenCalledTimes(2);

        // Calling dispose again must be a no-op.
        program.dispose();

        expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    });

    it("throws when gl.createShader returns null", () => {
        const gl = makeStubGl({ compileOk: true });

        (gl.createShader as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

        expect(() => new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, [], [])).toThrow(
            /createShader returned null/,
        );
    });

    it("throws when gl.createProgram returns null", () => {
        const gl = makeStubGl({ compileOk: true });

        (gl.createProgram as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

        expect(() => new Program(gl, VERTEX_SOURCE, FRAGMENT_SOURCE, [], [])).toThrow(
            /createProgram returned null/,
        );
    });
});
