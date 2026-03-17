---
slug: scheduler-agent-supervisor
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduler-agent-supervisor
primitive: sleep() for cooldown + sequential dispatch
pick: null
---

# Scheduler-Agent-Supervisor — Content Generation Pipeline

Dispatch content generation to multiple agents in sequence, each checked against a quality threshold; if one fails, route to the next agent after a cooldown.

## Variant A — "Three agents, one quality bar"

You need three agents to generate content. Agent 1 produces a draft. A supervisor scores it. If quality is below the threshold, wait and try Agent 2. If that fails too, escalate to Agent 3.

The traditional setup is an agent dispatch service, a quality gate service, an agent assignment database, and retry logic spread across all of them.

With `sleep()` and durable steps, it becomes a loop. Each agent call is a step. The quality check is a step. If the score fails the threshold, `sleep()` handles the cooldown before dispatching the next agent.

<!-- split -->

`sleep()` is durable. If the server restarts mid-cooldown, it resumes exactly where it left off. No timers to re-register. No state to recover. The supervisor logic is just an if-statement: pass means return, fail means next agent.

The dispatch order is array order. The routing logic is a for-loop. Each step checkpoints automatically.

<!-- split -->

No dispatch service. No agent registry. No retry queue with exponential backoff. Sequential dispatch, quality gates, and cooldown timers in a single workflow file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Durable cooldowns between agents"

Agent 1 scores below threshold. You need to wait 30 seconds before trying Agent 2. In a traditional setup, that means a timer service, a callback mechanism, and state recovery logic in case the server dies mid-wait.

`sleep()` is a durable primitive. Set it to 30 seconds and the workflow pauses. Server restarts? The sleep resumes from where it left off. No timer registration. No callback URL. No state database to query on restart.

<!-- split -->

The supervisor pattern is a for-loop over agents. Call the agent step. Check the quality step. Below threshold? `sleep()` for cooldown, then continue to the next agent. Above threshold? Return the result.

Each step is a checkpoint. If the quality check crashes, it retries from the check, not from the agent call. The agent's output is already persisted.

<!-- split -->

No timer service. No callback infrastructure. No agent state database. No manual checkpoint management. A for-loop, an if-statement, and `sleep()` give you the full scheduler-agent-supervisor pattern.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Escalation as a for-loop"

Escalation logic usually lives in a dispatch service with agent priority tables, assignment databases, and fallback routing rules. Changing the escalation order means a config change, a deploy, and a prayer.

Here, escalation order is array order. The agents array defines priority. A for-loop iterates through them. Each agent gets a step, a quality check, and a `sleep()` cooldown on failure. Pass the threshold and the loop breaks.

<!-- split -->

Adding a fourth agent means adding an element to the array. Changing priority means reordering the array. No config files. No dispatch service redeployment. No routing table update.

`sleep()` between agents is durable. Crash mid-cooldown and the workflow resumes the sleep, then dispatches the next agent. No lost position. No re-evaluation of already-failed agents.

<!-- split -->

No dispatch service. No priority database. No routing configuration. No escalation state machine. Agent priority is array order. Escalation is iteration. Quality gates are if-statements.

Explore the interactive demo on v0: {v0_link}
