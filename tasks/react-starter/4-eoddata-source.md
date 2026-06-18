# EODData data source — client + SQLite cache + daily quota

> **Status: TODO**

## Goal

Add the **EODData** market-data layer to `apps/react-starter`: a
server-only client that searches US symbols and fetches daily
end-of-day OHLCV, maps the response into chartlang `Bar[]`, caches every
result in the `eod_cache` table, and counts calls against the free
tier's **100 calls/day** quota using `api_usage`. The UI (Task 6) gets a
symbol picker + a `bars` array per symbol with zero accidental quota
burn.

## Prerequisites

- Task 3 (the `eodCache` + `apiUsage` tables and the DB client exist).

## Current Behavior

No market data. The site demo uses synthetic random-walk bars; the
starter must use real EODData daily bars.

## Desired Behavior

Selecting a US symbol loads its daily EOD history into the chart. A
repeat selection / page reload serves from the SQLite cache and makes
**no** API call. The user can see how many of their 100 daily calls
remain, and the layer refuses to exceed the quota.

## Requirements

### 1. EODData API + auth

- Reference: OpenAPI `https://api.eoddata.com/openapi/v1.json`, base
  `https://api.eoddata.com/scalar/v1`. Free tier: **100 calls/day, 10
  calls/min, daily EOD only, US equities (AMEX/NASDAQ/NYSE/OTCBB)**.
- API key from `EODDATA_API_KEY` (server env). Add to `.env.example`
  with a comment linking the free-tier registration. **Never** expose
  the key to the client — all EODData calls go through server fns.
- A tiny typed fetch wrapper (`eodFetch`) over `node:fetch`/global
  `fetch` with the auth header/param the OpenAPI spec requires; no SDK
  dependency.

> Confirm the exact endpoint paths + auth scheme against the live
> OpenAPI doc at implementation time (symbol list / quote / EOD history
> endpoints + whether the key is a header or query param). Encode the
> resolved shapes here as constants with a comment citing the spec.

### 2. Client — `src/lib/server/eod/client.ts` (server-only)

- `searchSymbols(query): Promise<SymbolHit[]>` — US exchanges only;
  cache the per-exchange symbol list in `eod_cache` under a synthetic
  `rangeKey` (`symbols:US`) with a long TTL (symbol lists change rarely)
  so search is mostly offline after the first load.
- `fetchDailyBars(symbol): Promise<Bar[]>` — daily EOD history mapped to
  chartlang `Bar` (`@invinite-org/chartlang-core`): `time` (ms epoch),
  `open/high/low/close/volume`, `symbol`, `interval: "1D"`, and the
  derived `hl2/hlc3/ohlc4/hlcc4`. Provide a `point(offset, price)` that
  resolves real history when available (the runtime injects the true
  `point` on its BarView, but supply a best-effort like the site does).

### 3. Cache + quota — `src/lib/server/eod/cache.ts`

- **Read-through cache:** `getDailyBars(symbol)` →
  `eodCache.get(symbol, "daily:max")`; if present and fresh (TTL, e.g.
  24h since `fetchedAt`), return it with `{ source: "cache" }` and **no**
  API call. Otherwise fetch, store, return `{ source: "network" }`.
- **Quota guard:** before any network call, read/increment
  `apiUsage[today-UTC].calls`. If `calls >= 100`, **do not** call the
  API — return the stale cache if any (with a `quotaExceeded: true`
  flag), else throw a typed `QuotaExceededError`. Increment only on an
  actual network call (cache hits cost nothing).
- `getUsage(): { day, calls, remaining }` for the UI badge.
- Respect the 10/min limit defensively (serialize requests / small
  in-process throttle); document that aggressive use still relies on the
  cache.

### 4. Server functions / route — `src/routes/api/eod.ts` (or server fns)

- `searchSymbols(query)`, `loadSymbol(symbol)` (→ `{ bars, source,
  quotaExceeded? }`), `usage()` — typed wrappers the UI calls. Validate
  `symbol` against an allowlist pattern (US ticker shape) before any
  fetch.

### 5. Wiring into saved scripts

When a script is loaded (Task 3) its `symbol` (if any) drives an
automatic `loadSymbol`; saving a script records the current symbol.
(Just the data plumbing here; the UI lands in Task 6.)

### Edge cases

- **Quota exhausted, no cache** → typed error surfaced to the UI as "out
  of EODData calls for today; cached symbols still work."
- **Unknown / non-US symbol** → 4xx from EODData mapped to a friendly
  "US daily symbols only" error; do **not** count a failed-validation
  call against quota (validate before fetch).
- **Empty history** → return `[]`; the chart shows an empty-state, not a
  crash.
- **Clock / day rollover** → the `apiUsage` key is UTC `YYYY-MM-DD`;
  document that the free tier resets on EODData's schedule, not local
  midnight, so the counter is a conservative guard, not an exact mirror.
- **Key missing** → boot the app fine but `loadSymbol` returns a clear
  "set EODDATA_API_KEY in .env" error (the seed script can still compile
  against cached/empty bars).

### Test (e2e/server, mocked network)

`tests/eod.spec.ts` — stub `eodFetch`: first `loadSymbol` hits network
(usage 1, source `network`); second serves cache (usage unchanged,
source `cache`); 101st distinct network attempt is refused with
`QuotaExceededError`; non-US symbol rejected pre-fetch (no usage
increment); bars map to valid `Bar` shape (derived fields correct).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/lib/server/eod/client.ts` | Create | EODData fetch + symbol search + Bar mapping |
| `apps/react-starter/src/lib/server/eod/cache.ts` | Create | read-through cache + quota guard |
| `apps/react-starter/src/lib/server/eod/types.ts` | Create | SymbolHit, errors, response shapes |
| `apps/react-starter/src/routes/api/eod.ts` (or server fns) | Create | typed UI endpoints |
| `apps/react-starter/.env.example` | Modify | `EODDATA_API_KEY` + free-tier note |
| `apps/react-starter/package.json` | Modify | (no new runtime dep ideally) |
| `apps/react-starter/tests/eod.spec.ts` | Create | cache + quota + mapping e2e |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build`
- `pnpm --filter chartlang-react-starter e2e` (eod, mocked)
- No coverage/changeset gate (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- A first symbol load fetches from EODData and caches; subsequent loads
  + reloads serve from SQLite with no API call.
- `apiUsage` increments only on real network calls; at 100/day the layer
  refuses to call and falls back to cache or a typed error.
- Bars map to a valid chartlang `Bar[]` (daily, US, `interval:"1D"`,
  derived fields correct).
- Non-US / unknown symbols and a missing key fail with friendly,
  non-quota-burning errors.
- EODData key never reaches the client bundle.
</content>
