# Draft picker (5 days)

Updated 2026-03-17 (bulkhead v0 + Typefully refreshed after turbopack fix)

---

### Day 1 — Aggregator

[v0 demo](https://v0.app/chat/fFETdq66hvt)

- [A · Wait for all, but not forever](https://typefully.com/t/Lio1lYX)
- [B · Proceed with partial data](https://typefully.com/t/9zviNIZ)
- [C · Durable hooks that survive crashes](https://typefully.com/t/5j4iLYd)

### Day 2 — Approval chain

[v0 demo](https://v0.app/chat/X3M2W5yZP1O)

- [A · Escalating sign-off](https://typefully.com/t/C1VIDLN)
- [B · Auto-escalate when someone ghosts](https://typefully.com/t/6vZWtEC)
- [C · One workflow, every tier](https://typefully.com/t/xnvry9N)

### Day 3 — Async request-reply

[v0 demo](https://v0.app/chat/fHayA1ZXNcZ)

- [A · Vendor calls you back later](https://typefully.com/t/z43AHmn)
- [B · Duplicate webhooks](https://typefully.com/t/beC5J5G)
- [C · Timeout vs callback race](https://typefully.com/t/0gV5f9n)

### Day 4 — Batch processor

[v0 demo](https://v0.app/chat/prfPMUPS2Y5)

- [A · Batch 47 crashed](https://typefully.com/t/dbeZdNS)
- [B · Replay without redoing work](https://typefully.com/t/rOgkVwT)
- [C · Same code path after restart](https://typefully.com/t/3cTmcOE)

### Day 5 — Bulkhead

[v0 demo](https://v0.app/chat/f4Pc9NKcSio)

- [A · One bad item doesn’t kill the batch](https://typefully.com/t/16HfiC2)
- [B · Bounded concurrency compartments](https://typefully.com/t/G2gDMAg)
- [C · Failure isolation](https://typefully.com/t/Je8kOHb)

---

_Maintainers:_ refresh Typefully drafts after editing `v0_url` in `.posts/<slug>.md`, then update links here:

`bun .scripts/typefully-publish.ts aggregator approval-chain async-request-reply batch-processor bulkhead --skip-v0`
