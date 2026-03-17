# Draft Picker

Week 1 draft links for quick review and selection.

Updated 2026-03-17
Note: `bulkhead` now uses a v0-safe `next.config.ts` without `turbopack.root`.

---

## Day 1: `aggregator`

[Open v0 demo](https://v0.app/chat/wS82DBhFkYY)

- [A: Wait for all, but not forever](https://typefully.com/t/Lio1lYX)
- [B: Proceed with partial data](https://typefully.com/t/9zviNIZ)
- [C: Durable hooks that survive crashes](https://typefully.com/t/5j4iLYd)

## Day 2: `approval-chain`

[Open v0 demo](https://v0.app/chat/tohtY2jLGXW)

- [A: Escalating sign-off](https://typefully.com/t/C1VIDLN)
- [B: Auto-escalate when someone ghosts](https://typefully.com/t/6vZWtEC)
- [C: One workflow, every tier](https://typefully.com/t/xnvry9N)

## Day 3: `async-request-reply`

[Open v0 demo](https://v0.app/chat/CMhyfOV95kP)

- [A: Vendor calls you back later](https://typefully.com/t/z43AHmn)
- [B: Duplicate webhooks](https://typefully.com/t/beC5J5G)
- [C: Timeout vs callback race](https://typefully.com/t/0gV5f9n)

## Day 4: `batch-processor`

[Open v0 demo](https://v0.app/chat/veJkYzFjTZY)

- [A: Batch 47 crashed](https://typefully.com/t/dbeZdNS)
- [B: Replay without redoing work](https://typefully.com/t/rOgkVwT)
- [C: Same code path after restart](https://typefully.com/t/3cTmcOE)

## Day 5: `bulkhead`

[Open v0 demo](https://v0.app/chat/vaDEaM2kUJb)

- [A: One bad item doesn’t kill the batch](https://typefully.com/t/PY52yvq)
- [B: Bounded concurrency compartments](https://typefully.com/t/7A5v5Hr)
- [C: Failure isolation](https://typefully.com/t/SzoQXds)

---

Maintainer refresh flow:

1. Update `v0_url` in the relevant `.posts/<slug>.md` files.
2. Regenerate the Typefully drafts.
3. Replace the links in this picker.

```bash
bun .scripts/typefully-publish.ts aggregator approval-chain async-request-reply batch-processor bulkhead --skip-v0
```
