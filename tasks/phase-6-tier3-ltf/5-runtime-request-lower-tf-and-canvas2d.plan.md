# Task 5 Plan

## Context

Wired runtime `request.lowerTf`, canvas2d sub-minute intervals, and LTF conformance scenarios.

## Steps

1. Extracted request diagnostic dedupe to `pushOnce`.
2. Added `makeLowerTfSeries` runtime implementation.
3. Added runtime context cache and disposal cleanup.
4. Added `"15s"` and `"30s"` to canvas2d capabilities.
5. Added three conformance scenarios.

## Gates

- `pnpm typecheck`
- focused runtime request tests

