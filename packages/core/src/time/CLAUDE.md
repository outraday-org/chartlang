# Core Time Helpers

- Public helpers must be pure over explicit `Time` and `tz` arguments.
- Do not read the host default timezone. Use `Intl.DateTimeFormat` with an explicit `timeZone`.
- Ported files keep the workspace provenance header with source path and commit.
- Reuse `_lib/dateTimeFormatCache.ts` for formatter construction.

