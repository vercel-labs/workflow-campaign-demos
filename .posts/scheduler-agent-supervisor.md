---
slug: scheduler-agent-supervisor
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduler-agent-supervisor
primitive: sleep() for cooldown + sequential dispatch
pick: null
---

# Scheduler-Agent-Supervisor — Content Generation Pipeline

Dispatch content generation to multiple agents in sequence, each checked against a quality threshold; if one fails, route to the next agent after a cooldown.

## Variant A — "The agent babysitter"


You need three agents. Agent 1 generates content. A supervisor scores it. If quality is below threshold, wait 30 seconds and try Agent 2.

Traditional: an agent dispatch service, a quality gate service, an agent assignment database, and retry logic spread across all of them.

With WDK it's a loop with `sleep()`:

```ts
import { sleep } from "workflow";

const AGENTS = ["fast-model", "thorough-model", "premium-model"];

export async function schedulerAgentSupervisor(topic: string, requiredScore: number) {
  "use workflow";

  for (const agent of AGENTS) {
    const draft = await dispatchToAgent(agent, topic);
    const quality = await checkQuality(draft, requiredScore);

    if (quality.passed) {
      return await publishContent(draft, quality);
    }

    await sleep("2s"); // cooldown before next agent
  }

  return { status: "failed" };
}
```

<!-- split -->

Each agent call is a durable step. The supervisor scores the output. If it fails the threshold, `sleep()` handles the cooldown, then the next agent gets dispatched.

No dispatch service. No assignment DB. The routing logic is a for-loop.

<!-- split -->

Agent 1 misses the bar. Wait 30s. Agent 2 tries. Still bad. Wait 30s. Agent 3 nails it.

Sequential dispatch, quality gates, and cooldown timers. One file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What happens when your best agent chokes?"

Your primary agent produces garbage. You need a fallback. Then a fallback for the fallback. Each with a cooldown so you don't hammer the API.

Traditional: a scheduler service, an agent registry, a quality scoring pipeline, and a retry queue with exponential backoff.

WDK replaces all of that with steps in a loop:

```ts
import { sleep } from "workflow";

const AGENTS = ["fast-model", "thorough-model", "premium-model"];

export async function schedulerAgentSupervisor(topic: string, requiredScore: number) {
  "use workflow";

  for (const agent of AGENTS) {
    const draft = await dispatchToAgent(agent, topic);
    const quality = await checkQuality(draft, requiredScore);

    if (quality.passed) {
      return await publishContent(draft, quality);
    }

    await sleep("2s"); // cooldown before next agent
  }

  return { status: "failed" };
}
```

<!-- split -->

`sleep()` is durable. If the server restarts mid-cooldown, it resumes exactly where it left off. No state to recover. No timers to re-register.

The supervisor is just an if-statement. Pass? Return. Fail? Next agent.

<!-- split -->

Three agents. One quality bar. Automatic fallback with cooldown between each attempt.

No queue. No agent registry. No retry infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Orchestrating agents without an orchestrator"

Agent orchestration frameworks are their own category of infrastructure. Dispatch tables, health checks, quality pipelines, cooldown management.

WDK turns it into sequential function calls with `sleep()`:

```ts
import { sleep } from "workflow";

const AGENTS = ["fast-model", "thorough-model", "premium-model"];

export async function schedulerAgentSupervisor(topic: string, requiredScore: number) {
  "use workflow";

  for (const agent of AGENTS) {
    const draft = await dispatchToAgent(agent, topic);
    const quality = await checkQuality(draft, requiredScore);

    if (quality.passed) {
      return await publishContent(draft, quality);
    }

    await sleep("2s"); // cooldown before next agent
  }

  return { status: "failed" };
}
```

<!-- split -->

Each agent is a step. The quality check is a step. The cooldown is `sleep()`. If all agents fail, the workflow completes with a failure result. No silent drops.

Every step is durable. Every sleep survives restarts. The dispatch order is just array order.

<!-- split -->

Dispatch Agent A. Score it. Below threshold? Cool down. Dispatch Agent B. Score it. Repeat until quality passes or agents run out.

Explore the interactive demo on v0: {v0_link}
