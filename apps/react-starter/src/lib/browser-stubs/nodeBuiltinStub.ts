// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from apps/site/src/lib/browser-stubs/nodeBuiltinStub.ts.
//
// Browser stand-in for node builtins that the compiler package imports at
// module scope but only calls server-side (compilation happens via
// /api/compile). Importing must succeed; calling must fail loudly.

function unavailable(name: string): (...args: ReadonlyArray<unknown>) => never {
    return () => {
        throw new Error(`node builtin "${name}" is not available in the browser`);
    };
}

export const randomBytes = unavailable("crypto.randomBytes");
export const createHash = unavailable("crypto.createHash");
export const readFile = unavailable("fs.readFile");
export const readdir = unavailable("fs.readdir");
export const rename = unavailable("fs.rename");
export const unlink = unavailable("fs.unlink");
export const writeFile = unavailable("fs.writeFile");
export const mkdir = unavailable("fs.mkdir");
export const mkdtemp = unavailable("fs.mkdtemp");
export const rm = unavailable("fs.rm");
// Path/url helpers return benign dummies instead of throwing: the compiler
// calls fileURLToPath(import.meta.url) at MODULE SCOPE to locate its package
// dir (browser-side compile is never invoked, only the import must succeed).
export const isAbsolute = (): boolean => false;
export const join = (...parts: ReadonlyArray<string>): string => parts.join("/");
export const relative = (): string => "";
export const resolve = (...parts: ReadonlyArray<string>): string => parts.join("/");
export const dirname = (p: string): string => p.split("/").slice(0, -1).join("/") || "/";
export const tmpdir = (): string => "/tmp";
export const fileURLToPath = (url: unknown): string => String(url).replace(/^file:\/\//, "");
export const pathToFileURL = (p: string): URL => new URL(`file://${p}`);

export default {
    randomBytes,
    createHash,
    readFile,
    readdir,
    rename,
    unlink,
    writeFile,
    mkdir,
    mkdtemp,
    rm,
    isAbsolute,
    join,
    relative,
    resolve,
    dirname,
    tmpdir,
    fileURLToPath,
    pathToFileURL,
};
