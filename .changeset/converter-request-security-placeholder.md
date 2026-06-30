---
"@invinite-org/chartlang-pine-converter": minor
---

Emit a safe `Number.NaN` placeholder for a rejected `request.security` (an
out-of-subset symbol/timeframe) instead of the verbatim broken call, so the
rest of the emitted file still type-checks; the `request-security-not-mapped`
error still flags the feed. `request.security` is now series-qualified, so a
history-indexed rejected feed is slot-backed.
