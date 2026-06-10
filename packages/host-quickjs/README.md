# @invinite-org/chartlang-host-quickjs

> Stability: experimental (since 0.5).

QuickJS-WASM `ScriptHost` for server-side and untrusted-script execution.
Mirrors `@invinite-org/chartlang-host-worker`'s protocol so consumers can swap
hosts behind the `ScriptHost` interface.
Sandbox-escape suite covers `Function` / `eval` / dynamic `import` /
`globalThis` / OOM / DoS / realm-leak / Symbol-iterator hijack / Proxy revoke.

## Install

```bash
pnpm add @invinite-org/chartlang-host-quickjs quickjs-emscripten
```

`quickjs-emscripten` is pinned as `^0.31.0`, a real-shipped major range.

## Public surface

- `createQuickJsHost(opts) -> ScriptHost`.
- `DEFAULT_QUICKJS_LIMITS` — 64 MB heap, 1 ms step, 30 s load-timeout.
- `HostToQuickJs` / `QuickJsToHost` — wire protocol mirror.

## Minimum-viable API call

```ts
import { DEFAULT_QUICKJS_LIMITS, createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";

void DEFAULT_QUICKJS_LIMITS;
const host = createQuickJsHost({ capabilities });
await host.load(compiled);
await host.push({ kind: "history", bars });
const emissions = await host.drain();
host.dispose();
void emissions;
```

## MV API

See PLAN §8.3 and §6.9.

## Docs

`docs/hosts/host-quickjs.md` (auto-generated).

## License

MIT.
