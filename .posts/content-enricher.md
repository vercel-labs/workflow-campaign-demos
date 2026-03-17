---
slug: content-enricher
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-content-enricher
primitive: Promise.allSettled() for partial success
pick: null
---

# Content Enricher — Lead Profile Hydration

Enrich a lead profile by querying 4 sources (CRM, social, Clearbit, GitHub) in parallel, then merge all available results, even if some sources fail.

## Variant A — "One failure shouldn't erase three successes"

A new lead signs up. You need to hydrate their profile from four sources. If Clearbit times out, do you throw away the other three results? Sequential calls are slow. Parallel calls without coordination lose partial results on the first failure.

`Promise.allSettled()` fans out to all four sources as independent durable steps. Every call completes — success or failure — without canceling the others.

<!-- split -->

Each source call is a `"use step"` with its own retry logic. `Promise.allSettled()` collects every outcome. The merge step sees what succeeded and what didn't, building the richest profile possible from whatever came back.

Crash mid-enrichment? Completed steps replay from the log instantly. Only the incomplete step re-runs.

<!-- split -->

No orchestration service. No retry coordinator. No dedup cache. Four calls, one merge, partial success built in.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The enrichment pipeline that doesn't block on Clearbit"

CRM responds in 50ms. GitHub in 200ms. Social API in 800ms. Clearbit is down. Your lead is waiting for a profile that's 75% ready while you block on the one source that won't respond.

`Promise.allSettled()` runs all four sources in parallel and waits for every one to settle. The merge step gets three successes and one failure, and builds the profile from what's available.

<!-- split -->

Each source is a durable step with automatic retries. Clearbit gets a few retry attempts, then gives up. The other three sources finished long ago. No source blocks another.

The merge step inspects each result's status. Fulfilled sources contribute their data. Rejected sources log a warning. The profile ships with everything that worked.

<!-- split -->

No waterfall of API calls. No failure-cancels-everything logic. No partial enrichment recovery job. Four parallel calls, a merge of whatever succeeded, and the profile is ready.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Partial data is better than no data"

Four enrichment sources. Different reliability. Different latency. The traditional choice is all-or-nothing: either every source responds or you retry the whole batch. That's wasteful when three out of four succeeded.

`Promise.allSettled()` gives you graduated success. Every source gets its own durable step, its own retries, and its own outcome. The merge step works with whatever came back.

<!-- split -->

CRM and GitHub succeed immediately. Social retries twice and then succeeds. Clearbit fails permanently. The merge step receives three fulfilled results and one rejected, and builds the richest profile it can.

Crash after CRM and GitHub complete? They replay instantly from the log. Only social and Clearbit re-execute.

<!-- split -->

No all-or-nothing enrichment. No batch retry on partial failure. No enrichment queue with dedup. Parallel calls, independent outcomes, and a merge that embraces partial success.

Explore the interactive demo on v0: {v0_link}
