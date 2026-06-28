#!/usr/bin/env node
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Reconcile every real `.env` with its sibling `.env.example`.
 *
 * The `.env.example` files are the source of truth for WHICH keys exist; the
 * real `.env` files own the actual VALUES (secrets, tokens, credentials).
 * After pulling a branch that changed an example, run this to bring each local
 * `.env` back in sync:
 *   - add keys that were added to the example (as the example's placeholder),
 *   - remove keys that were deleted from the example,
 *   - preserve every value you already set for keys that still exist,
 *   - adopt the example's comments/section layout/ordering.
 *
 * This is a pnpm workspace monorepo: examples live at the repo root and inside
 * `apps/*`, `packages/*`, `examples/*`, and `local-starters/*`. The script
 * discovers every `.env.example` recursively (ignoring build/cache dirs) and
 * reconciles its sibling `.env`, so it handles the whole monorepo in one pass.
 *
 * Safety: it never overwrites a value you already set, never prints secret
 * values, and `--dry-run` previews changes without writing.
 *
 * Usage:
 *   node scripts/sync-env-from-examples.mjs            # apply
 *   node scripts/sync-env-from-examples.mjs --dry-run  # preview only
 *   node scripts/sync-env-from-examples.mjs --check    # preview; exit 1 if out of sync (CI)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkMode = process.argv.includes("--check");
const dryRun = process.argv.includes("--dry-run") || checkMode;
const IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".turbo",
    ".next",
    "coverage",
    ".cache",
]);
const KEY_LINE = /^(\s*#\s*)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function findExampleFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            out.push(...findExampleFiles(path.join(dir, entry.name)));
        } else if (entry.name === ".env.example") {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

// Capture every KEY=value line from a real .env, keeping both the value and
// whether the user has it active or commented. An active occurrence wins over
// a commented one for the same key.
function parseEntries(filePath) {
    const active = new Map();
    const commented = new Map();
    if (!fs.existsSync(filePath)) return { active, commented };
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
        const m = line.match(KEY_LINE);
        if (!m) continue;
        if (m[1])
            commented.set(m[2], line); // m[1] = comment prefix
        else active.set(m[2], line);
    }
    return { active, commented };
}

// A var must be set by the user when its name looks like a credential/secret/
// token, or its value is a placeholder. Everything else is a config default
// that works as-is.
const SECRET_NAME =
    /(API_KEY|API_SECRET|PASSPHRASE|SECRET|TOKEN|ENCRYPTION_KEY|INVITE_CODE|DATABASE_URL)/;
// `x{4,}` catches this repo's masked-token convention (e.g. `npm_xxxxxxxx`).
const PLACEHOLDER_VALUE =
    /(^\s*$|replace-with|^\s*\.\.\.\s*$|<.+>|your-?|yourdomain|example\.com|changeme|paste-|x{4,}|hc-ping\.com\/your)/i;
function needsRealValue(key, value) {
    return SECRET_NAME.test(key) || PLACEHOLDER_VALUE.test(value);
}

// An *active* (uncommented) var whose value is still a placeholder/empty is set
// in name only — the app will reject it at boot. We surface these on every run,
// even for files that are otherwise in sync, so a half-filled `.env` can't hide.
function isUnset(value) {
    return PLACEHOLDER_VALUE.test(value);
}

function reconcile(examplePath, envPath) {
    const exampleLines = fs.readFileSync(examplePath, "utf8").split("\n");
    const { active, commented } = parseEntries(envPath);
    const exampleKeys = new Set();
    const outLines = [];
    const addedSecrets = []; // new active vars that need a real value
    const addedDefaults = []; // new active vars whose default works as-is
    const addedOptional = []; // new commented vars (enable + set only if used)

    for (const line of exampleLines) {
        const m = line.match(KEY_LINE);
        if (!m) {
            outLines.push(line);
            continue;
        } // section comments, blanks → layout
        const [, comment, key, value] = m;
        exampleKeys.add(key);
        if (active.has(key)) {
            outLines.push(active.get(key)); // preserve the user's active value
        } else if (commented.has(key)) {
            outLines.push(commented.get(key)); // preserve the user's commented/disabled line
        } else {
            // Genuinely new key: take the example line verbatim.
            outLines.push(line);
            if (comment) addedOptional.push(key);
            else if (needsRealValue(key, value)) addedSecrets.push(key);
            else addedDefaults.push(key);
        }
    }

    // Keys the user has (active or commented) that the example no longer defines.
    const removed = [...new Set([...active.keys(), ...commented.keys()])].filter(
        (k) => !exampleKeys.has(k),
    );
    const added = addedSecrets.length + addedDefaults.length + addedOptional.length;

    // Audit the RECONCILED file (not just this run's additions) for active keys
    // whose value is still a placeholder/empty. This is what catches a `.env` that
    // is structurally in sync but functionally unconfigured — e.g. a required
    // NPM_TOKEN left at its placeholder. Reported on every run.
    const unset = [];
    for (const line of outLines) {
        const m = line.match(KEY_LINE);
        if (m && !m[1] && isUnset(m[3])) unset.push(m[2]);
    }

    const next = outLines.join("\n");
    const prev = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : null;
    return {
        next,
        changed: next !== prev,
        created: prev === null,
        added,
        addedSecrets,
        addedDefaults,
        addedOptional,
        removed,
        unset,
    };
}

function rel(p) {
    return path.relative(repoRoot, p);
}

const examples = findExampleFiles(repoRoot).sort();
if (examples.length === 0) {
    console.log("No .env.example files found.");
    process.exit(0);
}

let changedCount = 0;
let unsetCount = 0;
const todos = []; // { file, unset, optional } per file that needs user action

for (const examplePath of examples) {
    const envPath = path.join(path.dirname(examplePath), ".env");
    const r = reconcile(examplePath, envPath);

    if (!r.changed) {
        // Still surface unset values even when the file is structurally in sync.
        if (r.unset.length) {
            console.log(
                `⚠ ${rel(envPath)} — in sync, but ${r.unset.length} var(s) still unset: ${r.unset.join(", ")}`,
            );
        } else {
            console.log(`✓ ${rel(envPath)} — already in sync`);
        }
    } else {
        changedCount += 1;
        let verb;
        if (r.created) verb = "CREATE";
        else if (dryRun) verb = "WOULD UPDATE";
        else verb = "UPDATED";
        console.log(`${r.created ? "+" : "~"} ${verb} ${rel(envPath)} (from ${rel(examplePath)})`);
        if (r.addedSecrets.length)
            console.log(`    + add (set value): ${r.addedSecrets.join(", ")}`);
        if (r.addedDefaults.length)
            console.log(`    + add (default):   ${r.addedDefaults.join(", ")}`);
        if (r.addedOptional.length)
            console.log(`    + add (optional):  ${r.addedOptional.join(", ")}`);
        if (r.removed.length) console.log(`    - remove:          ${r.removed.join(", ")}`);
        if (!r.created && r.added === 0 && r.removed.length === 0)
            console.log("      (comments/ordering normalized; values preserved)");
        if (!dryRun) fs.writeFileSync(envPath, r.next);
    }

    // `unset` (active placeholders in the reconciled file) is the authoritative
    // "needs a real value" list — it covers both newly added and pre-existing
    // placeholders. addedOptional stays separate (enable only if used).
    if (r.unset.length) unsetCount += 1;
    if (r.unset.length || r.addedOptional.length) {
        todos.push({ file: rel(envPath), unset: r.unset, optional: r.addedOptional });
    }
}

console.log(
    dryRun
        ? `\nDry run: ${changedCount} file(s) would change. Re-run without --dry-run to apply.`
        : `\nDone: ${changedCount} file(s) ${changedCount === 1 ? "was" : "were"} updated.`,
);

if (todos.length) {
    console.log("\nNext steps — set these before running the app:");
    for (const t of todos) {
        console.log(`  ${t.file}`);
        if (t.unset.length)
            console.log(`    🔑 set a real value (still placeholder/empty): ${t.unset.join(", ")}`);
        if (t.optional.length)
            console.log(
                `    💤 optional — uncomment + set only if you use it: ${t.optional.join(", ")}`,
            );
    }
    console.log("\nConfig defaults that were added need no change. Never commit real secrets.");
} else if (changedCount > 0) {
    console.log("No new credentials to set — only config defaults and/or layout were updated.");
}

// In CI/check mode, fail when any .env is out of sync OR still holds unset
// placeholder values, so the job stays actionable.
if (checkMode && (changedCount > 0 || unsetCount > 0)) {
    if (changedCount > 0)
        console.error(
            `\n--check: ${changedCount} .env file(s) out of sync. Run \`node scripts/sync-env-from-examples.mjs\` to fix.`,
        );
    if (unsetCount > 0)
        console.error(
            `--check: ${unsetCount} .env file(s) have unset placeholder values. Set them before deploying.`,
        );
    process.exit(1);
}
