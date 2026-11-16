// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest, StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";
import { stateStoreKeysEqual } from "@invinite-org/chartlang-core";

import type { AlertRunnerSnapshot, FrequencyGateState } from "./types.js";

function hex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

/**
 * SHA-256 of a UTF-8 string, hex. Web Crypto, so no `node:` import.
 *
 * @since 1.0
 * @internal
 * @example
 *     const digest = await sha256Hex("abc");
 *     void digest;
 */
export async function sha256Hex(value: string): Promise<string> {
    return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/**
 * Canonical JSON: object keys sorted at every depth, `undefined` members
 * dropped, and `Set` / `Map` serialized as sorted arrays. A `Set` must be
 * branched before the object case — `Object.entries(new Set([...]))` is `[]`,
 * so a plain walk would make every capability set invisible to the hash.
 *
 * @since 1.0
 * @internal
 * @example
 *     canonicalJson({ b: 1, a: new Set(["y", "x"]) }); // {"a":["x","y"],"b":1}
 */
export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
    if (value instanceof Set) {
        return `[${[...value]
            .map((entry) => canonicalJson(entry))
            .sort()
            .join(",")}]`;
    }
    if (value instanceof Map) {
        return `[${[...value.entries()]
            .map(([key, entry]) => `[${canonicalJson(key)},${canonicalJson(entry)}]`)
            .sort()
            .join(",")}]`;
    }
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            // Object keys are unique, so two entries never compare equal.
            .sort(([left], [right]) => (left < right ? -1 : 1))
            .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
        return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}

/**
 * Mint the persistent-store key (spec "State Persistence"): the script hash,
 * the compiler version, api version 1, the capability hash, the symbol, the
 * main interval and the SORTED requested intervals. `null` when the manifest
 * carries no `compilerVersion` — absent means unknown, and a consumer keying
 * a persistent store on it must bypass the store.
 *
 * @since 1.0
 * @internal
 * @example
 *     declare const args: Parameters<typeof buildStateStoreKey>[0];
 *     const key = await buildStateStoreKey(args);
 *     void key;
 */
export async function buildStateStoreKey(
    args: Readonly<{
        moduleSource: string;
        manifest: ScriptManifest;
        capabilities: Capabilities;
        symbol: string;
        interval: string;
    }>,
): Promise<StateStoreKey | null> {
    const compilerVersion = args.manifest.compilerVersion;
    if (compilerVersion === undefined) return null;
    const [scriptHash, capabilitiesHash] = await Promise.all([
        sha256Hex(args.moduleSource),
        sha256Hex(canonicalJson(args.capabilities)),
    ]);
    return {
        scriptHash,
        compilerVersion,
        apiVersion: 1,
        capabilitiesHash,
        symbol: args.symbol,
        mainInterval: args.interval,
        requestedIntervals: [...args.manifest.requestedIntervals].sort(),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function parseNumberRecord(value: unknown): Record<string, number> | null {
    if (!isRecord(value)) return null;
    const out: Record<string, number> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (!isFiniteNumber(entry)) return null;
        out[key] = entry;
    }
    return out;
}

function parseKey(value: unknown): StateStoreKey | null {
    if (!isRecord(value)) return null;
    const { scriptHash, compilerVersion, apiVersion, capabilitiesHash, symbol, mainInterval } =
        value;
    const requested = value.requestedIntervals;
    if (
        typeof scriptHash !== "string" ||
        typeof compilerVersion !== "string" ||
        apiVersion !== 1 ||
        typeof capabilitiesHash !== "string" ||
        typeof symbol !== "string" ||
        typeof mainInterval !== "string" ||
        !Array.isArray(requested) ||
        !requested.every((entry): entry is string => typeof entry === "string")
    ) {
        return null;
    }
    return {
        scriptHash,
        compilerVersion,
        apiVersion: 1,
        capabilitiesHash,
        symbol,
        mainInterval,
        requestedIntervals: requested,
    };
}

/**
 * Outcome of reading a stored snapshot against the runner's identity.
 *
 * @since 1.0
 * @internal
 * @example
 *     declare const match: SnapshotMatch;
 *     if (match.status === "match") void match.snapshot.lastBarTime;
 */
export type SnapshotMatch =
    | Readonly<{ status: "match"; snapshot: AlertRunnerSnapshot }>
    | Readonly<{ status: "key-mismatch" | "invalid" }>;

/**
 * Narrow an untrusted stored value into an {@link AlertRunnerSnapshot} and
 * compare its identity. Only the envelope is checked structurally; the
 * runtime validates the `state` payload itself on import, and a refusal
 * there is reported as `"invalid"` by the caller.
 *
 * @since 1.0
 * @internal
 * @example
 *     declare const key: Parameters<typeof matchSnapshot>[1];
 *     const match = matchSnapshot(JSON.parse("{}"), key, "inputs-hash");
 *     void match.status;
 */
export function matchSnapshot(
    value: unknown,
    key: StateStoreKey,
    inputsHash: string,
): SnapshotMatch {
    if (!isRecord(value) || value.format !== "chartlang-alert-runner" || value.version !== 1) {
        return { status: "invalid" };
    }
    const storedKey = parseKey(value.key);
    const secondary = parseNumberRecord(value.secondaryLastBarTimes);
    const gate = value.gate;
    if (
        storedKey === null ||
        typeof value.inputsHash !== "string" ||
        !(value.lastBarTime === null || isFiniteNumber(value.lastBarTime)) ||
        secondary === null ||
        !isRecord(gate) ||
        typeof gate.exhausted !== "boolean" ||
        !isRecord(value.state)
    ) {
        return { status: "invalid" };
    }
    const lastFired = parseNumberRecord(gate.lastFiredBarTime);
    if (lastFired === null) return { status: "invalid" };
    if (!stateStoreKeysEqual(storedKey, key) || value.inputsHash !== inputsHash) {
        return { status: "key-mismatch" };
    }
    const gateState: FrequencyGateState = {
        lastFiredBarTime: lastFired,
        exhausted: gate.exhausted,
    };
    return {
        status: "match",
        snapshot: {
            format: "chartlang-alert-runner",
            version: 1,
            key: storedKey,
            inputsHash: value.inputsHash,
            lastBarTime: value.lastBarTime,
            secondaryLastBarTimes: secondary,
            gate: gateState,
            state: value.state as StateSnapshot,
        },
    };
}
