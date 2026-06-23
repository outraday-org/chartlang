---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-editor": minor
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-language-service": patch
---

Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
(Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
helper, and an `input.session` kind. Calendar fields are derived from a `Time`
epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.
