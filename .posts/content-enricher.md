---
slug: content-enricher
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-content-enricher
primitive: Promise.allSettled() for partial success
pick: null
---

# Content Enricher — Lead Profile Hydration

Enrich a lead profile by querying 4 sources (CRM, social, Clearbit, GitHub) in parallel, then merge all available results, even if some sources fail.

## Variant A — "Partial data is still useful data"


A new lead signs up. You need to hydrate their profile from CRM, social, Clearbit, and GitHub. If Clearbit times out, do you throw away the other three results?

Traditional: an orchestration service with parallel API calls, retry policies per source, a dedup cache, and fallback logic when sources disagree.

Or you fan out with `Promise.allSettled()` and merge what comes back:

```ts
export async function enrichLeadProfile(email: string) {
  "use workflow";

  const baseLead = await lookupBaseContact(email);

  const [crm, social, clearbit, github] = await Promise.allSettled([
    fetchCrmEnrichment(baseLead),
    fetchSocialEnrichment(baseLead),
    fetchClearbitEnrichment(baseLead),
    fetchGitHubEnrichment(baseLead),
  ]);

  const profile = await mergeEnrichmentProfile(baseLead, {
    crm: crm.status === "fulfilled" ? crm.value : null,
    social: social.status === "fulfilled" ? social.value : null,
    clearbit: clearbit.status === "fulfilled" ? clearbit.value : null,
    github: github.status === "fulfilled" ? github.value : null,
  });

  return { email, baseLead, profile };
}
```

<!-- split -->

Four sources queried in parallel. Each is a durable step. `Promise.allSettled()` means a failure in one doesn't cancel the others. You get partial enrichment instead of total failure.

No orchestration service. No retry coordinator. The workflow is the coordinator.

<!-- split -->

CRM returns. Social returns. Clearbit times out. GitHub returns. Three out of four merge cleanly. The lead gets a rich profile now, not a perfect profile never.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Four APIs, one merge"

Enriching a record means calling multiple APIs. One is slow. One is flaky. One changes its schema quarterly. You still need to merge results and move on.

Traditional: a queue per source, a callback aggregator, dedup logic, and a timeout sweep.

WDK: four parallel steps, one `Promise.allSettled()`, one merge:

```ts
export async function enrichLeadProfile(email: string) {
  "use workflow";

  const baseLead = await lookupBaseContact(email);

  const [crm, social, clearbit, github] = await Promise.allSettled([
    fetchCrmEnrichment(baseLead),
    fetchSocialEnrichment(baseLead),
    fetchClearbitEnrichment(baseLead),
    fetchGitHubEnrichment(baseLead),
  ]);

  const profile = await mergeEnrichmentProfile(baseLead, {
    crm: crm.status === "fulfilled" ? crm.value : null,
    social: social.status === "fulfilled" ? social.value : null,
    clearbit: clearbit.status === "fulfilled" ? clearbit.value : null,
    github: github.status === "fulfilled" ? github.value : null,
  });

  return { email, baseLead, profile };
}
```

<!-- split -->

Each source call is its own durable step. If Clearbit throws, the step records the failure. The other three steps still complete. `allSettled` collects everything, successes and errors alike.

No partial-failure recovery logic. The runtime handles it.

<!-- split -->

Query CRM. Query social. Query Clearbit. Query GitHub. Merge results. One file. Five steps. Partial success built in.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Enrich without the orchestrator"

You need data from four sources to build a lead profile. Building an orchestration service for this feels like overkill. Doing it sequentially feels like a waste.

Parallel enrichment in a workflow file:

```ts
export async function enrichLeadProfile(email: string) {
  "use workflow";

  const baseLead = await lookupBaseContact(email);

  const [crm, social, clearbit, github] = await Promise.allSettled([
    fetchCrmEnrichment(baseLead),
    fetchSocialEnrichment(baseLead),
    fetchClearbitEnrichment(baseLead),
    fetchGitHubEnrichment(baseLead),
  ]);

  const profile = await mergeEnrichmentProfile(baseLead, {
    crm: crm.status === "fulfilled" ? crm.value : null,
    social: social.status === "fulfilled" ? social.value : null,
    clearbit: clearbit.status === "fulfilled" ? clearbit.value : null,
    github: github.status === "fulfilled" ? github.value : null,
  });

  return { email, baseLead, profile };
}
```

<!-- split -->

`Promise.allSettled()` runs four durable steps concurrently. Each step fetches one source. Failures are captured, not propagated. The merge step sees what succeeded and what didn't.

Crash mid-enrichment? Completed steps don't re-run. The workflow resumes from where it stopped.

<!-- split -->

No dedup cache. No callback coordinator. No retry policies scattered across services. Four calls, one merge, one file.

Explore the interactive demo on v0: {v0_link}
