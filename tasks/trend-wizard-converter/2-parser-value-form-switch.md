# Task 2 — Parser: support value-form `switch` expressions

> **Status: TODO**

## Goal

Support `switch` used as a value (an expression), e.g. the `cf_ma`
helper in Trend Wizard:

```pine
cf_ma(input_val, ma_type, ma_lgth) =>
    float result = switch ma_type
        "SMA" => ta.sma(input_val, ma_lgth)
        "EMA" => ta.ema(input_val, ma_lgth)
        "WMA" => ta.wma(input_val, ma_lgth)
        "HMA" => ta.hma(input_val, ma_lgth)
```

Add a real `SwitchExpression` AST node, a Pratt rule, and
transform/codegen lowering. Removing the current hard reject also
**clears the two `unexpected-token` cascades** in the full script (they
are recovery artifacts of the reject, verified in
[`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Parser issue 3 + non-issue).

## Prerequisites

None. (Independent of Task 1; both are pure parser. Sequenced after 1
only for numbering.)

## Current Behavior

`rejectValueSwitch` (`packages/pine-converter/src/parser/statements.ts`
~L196-204) is called from `parseVariableDeclaration` (~L220),
`parseAssignment` (~L256), `parseTupleDeclaration` (~L312). It emits
`switch-expression-unsupported` and calls `recoverCompound`, which in
the full script mis-aligns the cursor → downstream `unexpected-token`.

Reproduce (isolated):

```bash
cat > /tmp/vswitch.pine <<'EOF'
//@version=6
indicator("t", overlay=false)
f(t) =>
    float result = switch t
        "SMA" => ta.sma(close, 10)
        "EMA" => ta.ema(close, 10)
plot(f("SMA"))
EOF
node packages/cli/dist/bin.js pine-convert /tmp/vswitch.pine --report
# before: error[switch-expression-unsupported]
```

## Desired Behavior

- A `switch` in value position parses into a `SwitchExpression` and
  lowers to chartlang that reproduces Pine semantics: the first arm
  whose label matches the subject yields its expression; a wildcard arm
  (`=> expr` with no label) is the default; **no match yields `na`**
  (Pine returns `na` when nothing matches and there's no default — the
  `cf_ma` case has no default, so unmatched `ma_type` ⇒ `na`).
- `switch-expression-unsupported` is **retired from the value-position
  path**. Keep the code entry in `DIAGNOSTIC_CODE_ENTRIES`
  (append-only / stable contract — never delete a code) but stop
  emitting it for the now-supported form. If a genuinely unsupported
  switch-expression sub-shape remains (see Edge Cases), it may still
  fire for that residual shape.

## Requirements

1. **AST node** — `packages/pine-converter/src/ast/expressions.ts`: add

   ```ts
   export type SwitchExpression = WithSpan & Readonly<{
     kind: "switch-expression";
     subject: ExpressionNode | null;   // `switch x` → Identifier; `switch` (boolean form) → null
     cases: readonly SwitchCase[];     // reuse SwitchCase from ast/statements.ts
   }>;
   ```
   Add `SwitchExpression` to the `ExpressionNode` union. `ast/expressions.ts`
   is coverage-excluded (declaration-only) per `vitest.config.ts`.

   **Note on `SwitchCase`** (`src/ast/statements.ts` ~L229-233): its fields
   are `test: ExpressionNode | null` (the arm label/condition) and
   `body: readonly Statement[]` (a statement *list* — the inline comma form
   is parsed as multiple statements). In **value** position an arm yields a
   single expression, so when lowering you must take the arm's value
   expression out of `body` (the sole/last expression-statement). Reusing
   `SwitchCase` is fine, but if the statement-list shape makes value
   extraction awkward, define a dedicated `SwitchExpressionCase`
   (`test` + `value: ExpressionNode`) instead — decide and keep it covered.

2. **Parser** — Pratt parser
   (`packages/pine-converter/src/parser/expressions.ts`): add a prefix
   rule for the `switch` keyword that parses the optional subject and
   the indented case block. **Reuse `parseSwitchCase`** (and the arm
   block logic) from `src/parser/statements.ts` — extract a shared
   arm-parsing helper if needed rather than duplicating. Pine's two
   forms:
   - `switch subject` then arms `label => expr`.
   - `switch` (no subject) then arms `cond => expr` (boolean form).
   Each arm body in value position is a single expression (or the
   inline comma form already handled for statements — but in value
   position only the last expression is the arm value; confirm against
   Pine semantics and keep it minimal: Trend Wizard uses single-expr
   arms).

3. **Remove the guards** — delete the `rejectValueSwitch` calls at the
   three declaration sites; let `parseExpression` handle `switch`
   naturally. Remove `rejectValueSwitch` itself if now dead (keep
   coverage at 100% — no dead code).

4. **Transform/codegen lowering** — `SwitchExpression` is an *expression*,
   so it lowers in **expression emission**:
   `packages/pine-converter/src/transform/exprEmit.ts` (this is where
   `emitNa` lives, ~L55, and where every `ExpressionNode` variant is
   rendered). Lower it to a chained ternary that matches Pine:
   ```
   subject === "SMA" ? ta.sma(...) :
   subject === "EMA" ? ta.ema(...) :
   ... : na
   ```
   For the subject-less boolean form, lower each arm's condition
   directly (`cond1 ? expr1 : cond2 ? expr2 : ... : na`). Reuse the
   existing ternary/`na` emission helpers in `exprEmit.ts`. For
   consistency, match the **statement-form** switch lowering in
   `src/transform/controlFlow.ts` (`emitSwitch` ~L648-663,
   `emitSubjectlessSwitch` ~L665-685) — the value form should map the same
   subject/arm semantics onto a ternary instead of a JS `switch`/`if`
   chain. (`src/codegen/emit.ts` orchestrates codegen but does not itself
   render expressions — do **not** put the switch lowering there.) Mind
   operator precedence / parenthesization in the emitted source.

5. **Diagnostics** — no new code. Reference existing codes by key only.

## Edge Cases

- Switch with no matching arm and no default → `na` (the `cf_ma` case).
- `switch` subject that is an arbitrary expression, not just an
  identifier (e.g. `switch math.sign(x)`).
- Subject-less boolean switch form.
- Switch expression nested inside a larger expression / as a function
  argument (Pratt precedence — ensure it parenthesizes correctly).
- Switch expression assigned via `:=` and via tuple declaration (the
  three former guard sites all exercised).
- A switch-expression sub-shape you choose **not** to support (e.g.
  multi-statement arm bodies in value position) must still emit a clear
  diagnostic, not a parser crash — decide and test it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/ast/expressions.ts` | Modify | `SwitchExpression` node + union member. |
| `packages/pine-converter/src/parser/expressions.ts` | Modify | Pratt prefix rule for value-form switch. |
| `packages/pine-converter/src/parser/statements.ts` | Modify | Remove `rejectValueSwitch` guards; extract shared arm helper. |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | Lower `SwitchExpression` → chained ternary + `na` (expression emission; reuse `emitNa`). |
| `packages/pine-converter/src/transform/controlFlow.ts` | Reference | Mirror the statement-form `emitSwitch`/`emitSubjectlessSwitch` semantics. |
| `packages/pine-converter/src/parser/parse-switch-value-reject.test.ts` | Modify | This existing test asserts the value-switch **reject**; it will break once the guard is removed. Repurpose it to the chosen residual unsupported sub-shape (or delete if fully covered elsewhere). |
| `packages/pine-converter/src/parser/*.test.ts`, `src/transform/*.test.ts` | Modify/Add | Unit + golden-style lowering tests. |
| `packages/pine-converter/src/**/*.synthetic.test.ts` | Add if needed | Cover any parser-unreachable defensive arm. |

## Tests (co-located, 100% coverage)

- Parse: value-switch with subject; subject-less boolean form; nested
  in an expression; via `=`, `:=`, tuple decl.
- Lowering: emitted chartlang matches expected ternary incl. the
  trailing `: na`; verify byte output via a focused transform test.
- Property test (`fast-check`) over N arms / random labels → lowering
  shape is well-formed and parenthesized.
- Negative: the chosen unsupported sub-shape emits its diagnostic.
- `cf_ma` exact snippet → zero diagnostics.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% coverage)
- `pnpm converter:docs:check` (no code added, but run to be safe)
- `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → `@invinite-org/chartlang-pine-converter`
**minor**: "Support value-form `switch` expressions (`x = switch s
...`); lower to a chained ternary."

## Acceptance Criteria

- Isolated `cf_ma` repro → zero diagnostics; emitted lowering matches
  Pine semantics (unmatched ⇒ `na`).
- On the full script: `switch-expression-unsupported` (L193) **and**
  both `unexpected-token` cascades (L215, EOF) gone from `--report`.
- 100% coverage; no dead code; typecheck green.
- `packages/pine-converter/CLAUDE.md` updated: it **currently documents**
  the invariant "A `switch` used as a VALUE is a clean parse reject … 
  Lowering it to a ternary chain (a new `SwitchExpression` node + Pratt
  surgery) is a deferred follow-up." That statement is now false — rewrite
  it to describe the supported value form and its ternary lowering.
- `skills/chartlang-coding/references/translating-from-pine.md` updated
  (value-form switch is now supported user-facing behavior).
- Changeset committed.
