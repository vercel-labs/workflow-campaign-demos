---
slug: recipient-list
title: Recipient List
v0: null
pick: null
---

Evaluate routing rules at runtime. Deliver to every matching channel. Skip the rest.

## Variant A — "Route by severity"

An alert fires. Who should know? Slack always. Email for warnings. PagerDuty only for critical. A webhook for anything above info.

Hard-coding these routes means redeploying when policies change. Spreading them across services means nobody knows the full picture.

With WDK, routing rules live in one place and execute durably:

<!-- split -->

`RULES.filter(r => r.match(severity))` evaluates which channels match. `Promise.allSettled()` delivers to all of them in parallel. `getWritable()` streams each delivery event to the UI in real time.

Slack gets every alert. PagerDuty only wakes up for critical. The decision is visible, auditable, and durable.

<!-- split -->

One workflow. One set of rules. Every delivery independently tracked. No message bus configuration. No routing table in a database.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Dynamic channel list"

The channel list isn't static — it comes from a team's notification preferences stored in a database. The workflow evaluates preferences at runtime and delivers only to opted-in channels.

<!-- split -->

The same `Promise.allSettled()` + `getWritable()` pattern works regardless of whether rules are hardcoded or fetched. Each delivery is a separate `"use step"` — independently retryable, independently observable.

If PagerDuty fails, email still delivers. If the team later adds SMS, the workflow picks it up on the next run without redeployment.

<!-- split -->

Dynamic routing with durable delivery. Each channel is independent. Failures are isolated. The recipient list is evaluated fresh every run.

Explore the interactive demo on v0: {v0_link}
