# Draft picker — Slack copy-paste (5 days)

**Updated:** 2026-03-17  

Pick **one variant (A, B, or C) per day** for X. Each Typefully link opens a thread draft with the **current v0 demo URL** baked in. Code in tweets uses Unicode monospace where noted in the pipeline.

---

## How to use

1. Open the **Typefully share** link for the variant you want.
2. Quick-read the v0 demo if needed.
3. Approve in Slack (e.g. react or reply with day + variant).
4. Schedule or post from Typefully.

---

## Day 1 — Aggregator — *Collect signals with timeout*

**Primitive:** `Promise.race()` + `defineHook()` + `sleep()`  
**v0 demo:** https://v0.app/chat/fFETdq66hvt  

| Variant | Angle | Typefully (open draft) |
|--------|--------|-------------------------|
| **A** | Wait for all, but not forever | https://typefully.com/t/Lio1lYX |
| **B** | Proceed with partial data | https://typefully.com/t/9zviNIZ |
| **C** | Durable hooks that survive crashes | https://typefully.com/t/5j4iLYd |

---

## Day 2 — Approval chain — *Multi-level approval + timeouts*

**Primitive:** `Promise.race()` + `defineHook()` + `sleep()`  
**v0 demo:** https://v0.app/chat/X3M2W5yZP1O  

| Variant | Angle | Typefully |
|--------|--------|-----------|
| **A** | Escalating sign-off | https://typefully.com/t/C1VIDLN |
| **B** | Auto-escalate when someone ghosts | https://typefully.com/t/6vZWtEC |
| **C** | One workflow, every tier | https://typefully.com/t/xnvry9N |

---

## Day 3 — Async request-reply — *Wait for the callback*

**Primitive:** `createWebhook()` + `Promise.race()` + `sleep()`  
**v0 demo:** https://v0.app/chat/fHayA1ZXNcZ  

| Variant | Angle | Typefully |
|--------|--------|-----------|
| **A** | Vendor calls you back later | https://typefully.com/t/z43AHmn |
| **B** | Duplicate webhooks | https://typefully.com/t/beC5J5G |
| **C** | Timeout vs callback race | https://typefully.com/t/0gV5f9n |

---

## Day 4 — Batch processor — *Crash-proof batches*

**Primitive:** durable replay + checkpoints  
**v0 demo:** https://v0.app/chat/prfPMUPS2Y5  

| Variant | Angle | Typefully |
|--------|--------|-----------|
| **A** | Batch 47 crashed | https://typefully.com/t/dbeZdNS |
| **B** | Replay without redoing work | https://typefully.com/t/rOgkVwT |
| **C** | Same code path after restart | https://typefully.com/t/3cTmcOE |

---

## Day 5 — Bulkhead — *Isolated parallel work*

**Primitive:** `Promise.allSettled()` + `sleep()`  
**v0 demo:** https://v0.app/chat/0LXZOKw1AbS  

| Variant | Angle | Typefully |
|--------|--------|-----------|
| **A** | One bad item doesn’t kill the batch | https://typefully.com/t/gUgLr8b |
| **B** | Bounded concurrency compartments | https://typefully.com/t/45nrA3I |
| **C** | Failure isolation | https://typefully.com/t/INYFoLo |

---

## One-block paste for Slack

```
5-day draft slate (2026-03-17) — pick 1 variant per day

D1 Aggregator — v0 https://v0.app/chat/fFETdq66hvt
  A https://typefully.com/t/Lio1lYX | B https://typefully.com/t/9zviNIZ | C https://typefully.com/t/5j4iLYd

D2 Approval chain — v0 https://v0.app/chat/X3M2W5yZP1O
  A https://typefully.com/t/C1VIDLN | B https://typefully.com/t/6vZWtEC | C https://typefully.com/t/xnvry9N

D3 Async request-reply — v0 https://v0.app/chat/fHayA1ZXNcZ
  A https://typefully.com/t/z43AHmn | B https://typefully.com/t/beC5J5G | C https://typefully.com/t/0gV5f9n

D4 Batch processor — v0 https://v0.app/chat/prfPMUPS2Y5
  A https://typefully.com/t/dbeZdNS | B https://typefully.com/t/rOgkVwT | C https://typefully.com/t/3cTmcOE

D5 Bulkhead — v0 https://v0.app/chat/0LXZOKw1AbS
  A https://typefully.com/t/gUgLr8b | B https://typefully.com/t/45nrA3I | C https://typefully.com/t/INYFoLo
```

---

## Regenerate drafts (maintainers)

Posts use `v0_url` in frontmatter (`.posts/<slug>.md`). New Typefully drafts without re-publishing v0:

```bash
bun .scripts/typefully-publish.ts aggregator approval-chain async-request-reply batch-processor bulkhead --skip-v0
```

Then update this file with the printed Typefully share URLs.
