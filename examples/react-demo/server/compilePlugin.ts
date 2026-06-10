// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Vite dev-server plugin that exposes `POST /api/compile`. The browser
// posts `{ source }`, the server runs the real chartlang compiler (and
// the language service's `compileToDiagnostics` for mapped LSP errors),
// and returns either the compiled triple or the diagnostics.
//
// Lives in `server/` because Vite NEVER routes this file through the
// browser bundle (the `esbuild` -> stub alias would otherwise neutralise
// it). vite.config.ts imports this module directly at config time.

import { CompileError, compile } from "@invinite-org/chartlang-compiler";
import { createLanguageService } from "@invinite-org/chartlang-language-service";
import type { Plugin, ViteDevServer } from "vite";

/**
 * Successful compile response. `moduleSource` + `manifest` flow straight
 * into `adapter.host.load(...)`; `diagnostics` is the (possibly empty)
 * LSP-style array the editor's linter consumes.
 */
export type CompileSuccess = Readonly<{
    ok: true;
    moduleSource: string;
    manifest: unknown;
    diagnostics: ReadonlyArray<unknown>;
}>;

/**
 * Failed compile response — script had at least one error-severity
 * diagnostic. The browser keeps its last good chart and surfaces the
 * diagnostics in the gutter / status bar.
 */
export type CompileFailure = Readonly<{
    ok: false;
    diagnostics: ReadonlyArray<unknown>;
}>;

const COMPILE_ROUTE = "/api/compile";
const SOURCE_PATH = "demo.chart.ts";

function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
            try {
                const text = Buffer.concat(chunks).toString("utf8");
                resolve(text.length === 0 ? null : JSON.parse(text));
            } catch (err) {
                reject(err);
            }
        });
        req.on("error", reject);
    });
}

function extractSource(body: unknown): string | null {
    if (body === null || typeof body !== "object") return null;
    const candidate = (body as { source?: unknown }).source;
    return typeof candidate === "string" ? candidate : null;
}

async function handleCompile(source: string): Promise<CompileSuccess | CompileFailure> {
    const languageService = createLanguageService();
    const diagnostics = await languageService.compileToDiagnostics(source);
    try {
        const compiled = await compile(source, { apiVersion: 1, sourcePath: SOURCE_PATH });
        return {
            ok: true,
            moduleSource: compiled.moduleSource,
            manifest: compiled.manifest,
            diagnostics,
        };
    } catch (err) {
        if (err instanceof CompileError) {
            return { ok: false, diagnostics };
        }
        throw err;
    }
}

function writeJson(
    res: import("node:http").ServerResponse,
    status: number,
    body: unknown,
): void {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
}

/**
 * Build the Vite dev-server plugin. Mounting it adds the
 * `POST /api/compile` route used by the demo's hybrid language service.
 */
export function chartlangCompilePlugin(): Plugin {
    return {
        name: "chartlang-compile",
        configureServer(server: ViteDevServer): void {
            server.middlewares.use(COMPILE_ROUTE, async (req, res, next) => {
                if (req.method !== "POST") {
                    next();
                    return;
                }
                try {
                    const body = await readJsonBody(req);
                    const source = extractSource(body);
                    if (source === null) {
                        writeJson(res, 400, {
                            ok: false,
                            error: "Request body must be JSON: { source: string }",
                        });
                        return;
                    }
                    const result = await handleCompile(source);
                    writeJson(res, 200, result);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    writeJson(res, 500, { ok: false, error: message });
                }
            });
        },
    };
}
