// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

/**
 * A resolved vertex-attribute slot: its declared name, the location the
 * linker assigned (`-1` when the attribute was stripped as unused), and
 * the `size` / `type` a {@link import("./vao.js").Vao} layout binds it
 * with. `size` / `type` default to a single `gl.FLOAT` here and are
 * overridden per-layout by the consumer.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const b: AttributeBinding;
 *     b.location >= 0;
 *     void b;
 */
export type AttributeBinding = {
    readonly name: string;
    readonly location: number;
    readonly size: 1 | 2 | 3 | 4;
    readonly type: number;
};

/**
 * A resolved uniform slot. Only uniforms that are *active* in the linked
 * program (i.e. `gl.getUniformLocation` returned non-null) are recorded —
 * a declared-but-optimised-out uniform is silently absent.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const u: UniformBinding;
 *     void u.name;
 */
export type UniformBinding = {
    readonly name: string;
    readonly location: WebGLUniformLocation;
};

/**
 * Prefix each source line with a 1-based line number so a compile error's
 * info log (`ERROR: 0:<line>: …`) can be read against the offending line.
 */
function numberShaderSource(source: string): string {
    return source
        .split("\n")
        .map((line, idx) => `${String(idx + 1).padStart(3, " ")}: ${line}`)
        .join("\n");
}

/** Compile one shader stage; throw with the info log + numbered source on failure. */
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);

    if (shader === null) {
        throw new Error("Program: gl.createShader returned null");
    }

    gl.shaderSource(shader, source);

    gl.compileShader(shader);

    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true;

    if (!ok) {
        const log = gl.getShaderInfoLog(shader) ?? "(no info log)";

        const numbered = numberShaderSource(source);

        gl.deleteShader(shader);
        throw new Error(
            `Program: shader compile failed.\n--- info log ---\n${log}\n--- source ---\n${numbered}`,
        );
    }

    return shader;
}

/** Link a vertex + fragment shader into a program; throw with the info log on failure. */
function linkProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
): WebGLProgram {
    const program = gl.createProgram();

    if (program === null) {
        throw new Error("Program: gl.createProgram returned null");
    }

    gl.attachShader(program, vertexShader);

    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    const ok = gl.getProgramParameter(program, gl.LINK_STATUS) === true;

    if (!ok) {
        const log = gl.getProgramInfoLog(program) ?? "(no info log)";

        gl.deleteProgram(program);
        throw new Error(`Program: link failed: ${log}`);
    }

    return program;
}

/**
 * A compiled + linked WebGL2 shader program with its attribute/uniform
 * locations cached at construction. The shared base every later program
 * (candle bodies/wicks, line-strip, bars, …) wraps. Construction compiles
 * both stages, links, and resolves the named attributes/uniforms; a
 * compile or link failure throws with the shader source + info log.
 *
 * "Translate, not transcribe": invinite's `tcLog` observability and the
 * DEV `assertCurrent()` use-before-set check are dropped — the surface
 * here is the raw WebGL2 program lifecycle only.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const vs = "#version 300 es\nin vec2 aPos;\nvoid main(){gl_Position=vec4(aPos,0.,1.);}";
 *     const fs = "#version 300 es\nprecision highp float;\nout vec4 o;\nvoid main(){o=vec4(1.);}";
 *     const program = new Program(gl, vs, fs, ["aPos"], []);
 *     program.use();
 *     program.dispose();
 */
export class Program {
    readonly gl: WebGL2RenderingContext;
    readonly glProgram: WebGLProgram;

    private readonly vertexShader: WebGLShader;
    private readonly fragmentShader: WebGLShader;
    private readonly attributes: Map<string, AttributeBinding>;
    private readonly uniforms: Map<string, UniformBinding>;
    private disposed = false;

    constructor(
        gl: WebGL2RenderingContext,
        vertexSource: string,
        fragmentSource: string,
        attributeNames: ReadonlyArray<string>,
        uniformNames: ReadonlyArray<string>,
    ) {
        this.gl = gl;

        this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);

        this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

        this.glProgram = linkProgram(gl, this.vertexShader, this.fragmentShader);

        this.attributes = new Map();

        for (const name of attributeNames) {
            const location = gl.getAttribLocation(this.glProgram, name);

            this.attributes.set(name, { location, name, size: 1, type: gl.FLOAT });
        }

        this.uniforms = new Map();

        for (const name of uniformNames) {
            const location = gl.getUniformLocation(this.glProgram, name);

            if (location === null) {
                continue;
            }

            this.uniforms.set(name, { location, name });
        }
    }

    /** Bind this program as the current GL program. */
    use(): void {
        this.gl.useProgram(this.glProgram);
    }

    /** Resolve a declared attribute binding; throws if it was never declared. */
    getAttribute(name: string): AttributeBinding {
        const binding = this.attributes.get(name);

        if (binding === undefined) {
            throw new Error(`Program: attribute "${name}" not declared`);
        }

        return binding;
    }

    /** Resolve a declared, active uniform binding; throws if absent. */
    getUniform(name: string): UniformBinding {
        const binding = this.uniforms.get(name);

        if (binding === undefined) {
            throw new Error(
                `Program: uniform "${name}" not declared (or not active in linked program)`,
            );
        }

        return binding;
    }

    /** Set a `float` uniform. */
    setUniform1f(name: string, value: number): void {
        this.gl.uniform1f(this.getUniform(name).location, value);
    }

    /** Set a `vec2` uniform. */
    setUniform2f(name: string, x: number, y: number): void {
        this.gl.uniform2f(this.getUniform(name).location, x, y);
    }

    /** Set a `vec4` uniform from a 4-element array. */
    setUniform4fv(name: string, values: Float32Array): void {
        this.gl.uniform4fv(this.getUniform(name).location, values);
    }

    /** Set a `mat3` uniform from a 9-element column-major array. */
    setUniformMatrix3fv(name: string, matrix: Float32Array): void {
        this.gl.uniformMatrix3fv(this.getUniform(name).location, false, matrix);
    }

    /** Delete the program + both shaders and clear the binding caches. Idempotent. */
    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;

        this.gl.deleteProgram(this.glProgram);

        this.gl.deleteShader(this.vertexShader);

        this.gl.deleteShader(this.fragmentShader);

        this.attributes.clear();

        this.uniforms.clear();
    }
}
