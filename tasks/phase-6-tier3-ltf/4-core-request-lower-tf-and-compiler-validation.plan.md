# Task 4 Plan

## Context

Implemented public `request.lowerTf` and compiler-side interval collection/validation support.

## Steps

1. Added `RequestLowerTfOpts` and core request stub.
2. Added `request.lowerTf` to the callsite-id registry.
3. Extended requested interval extraction.
4. Added `lower-tf-not-lower` diagnostic and validation pass.
5. Updated ambient compiler shim.

## Gates

- `pnpm typecheck`
- focused compiler tests

