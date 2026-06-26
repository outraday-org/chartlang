---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
---

Map the Pine `map.*` keyed-collection family onto the chartlang `state.map`
handle surface and prove it across every adapter.

- **Converter:** a new internal `MAP_BUILTIN_MAP` (`mapping/mapBuiltins.ts`)
  lowers `map.put` → `<slot>.set`, `map.get` → `(<slot>.get(k) ?? Number.NaN)`
  (na-bridged — chartlang returns `undefined`, Pine `na`), `map.contains` →
  `has`, `map.remove` → `delete`, `map.size` → `size`, and `map.clear` → `clear`
  onto a `state.map<number, number>(cap)` slot scanned by
  `transform/mapCollection.ts`. Pine maps are unbounded, so the converter
  **synthesizes** a literal capacity (default `1000`) + a
  `map-capacity-synthesized` info; a non-numeric value map raises
  `map-collection-non-numeric` (info) and is not lowered; `map.keys`/`map.values`
  (no v1 iterators) and any unmapped `map.*` over a slot emit a `Number.NaN`
  placeholder + `map-builtin-not-mapped` (warning) rather than hard-failing.
  `map` is now a recognised Pine namespace. Fixture `36-map-volume-by-level`
  covers the clean family.
- **Conformance:** `map-accumulator` pins a per-rounded-price volume profile
  (value-at-key + tracked-level count) over a `state.map<number, number>(32)`
  store. `state.map` is pure compute that rides the existing `plot` hole — **no
  new wire primitive and no per-adapter code change** — so `pnpm conformance`
  replays the scenario through every adapter and asserts byte-stable output. No
  adapter diff is expected.
