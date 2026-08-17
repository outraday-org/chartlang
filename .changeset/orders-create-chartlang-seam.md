---
"@invinite-org/create-chartlang": minor
---

The starter's adapter seam forwards an `onOrder` sink

`CreateAdapterOpts` gains `onOrder?: (o: OrderEmission) => void`, forwarded by
all six emitted seams. Without it a scaffolded app could render the auto-drawn
order arrows but had no way to read the intents behind them: `ChartPane` reaches
its adapter only through `createActiveAdapter`, and no example adapter accepts a
sink after construction — so a post-hoc subscription was not expressible in the
starter at all.

The sink renders nothing. Order markers ride the ordinary plot pipeline; this is
the door to the structured channel, for a starter that wants to list its trades,
run a simulator, or forward them somewhere.
