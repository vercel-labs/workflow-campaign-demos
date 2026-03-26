---
slug: request-reply
title: Request-Reply
subtitle: Send a request, wait for a correlated reply, timeout and retry if it doesn't arrive.
v0_link: null
pick: null
---

Send a request, wait for a correlated reply, timeout and retry if it doesn't arrive.

## Variant A — "Call and wait, but not forever"

You need data from three services before responding to the user. Each service might be slow. One might be down entirely.

Each service gets its own request step with a deadline. If the reply doesn't arrive in time, retry. If retries exhaust, mark it failed and move on.

<!-- split -->

Sequential fan-out: send a request, race the reply against a `sleep()` deadline. On timeout, retry up to N times. On success, collect the response and move to the next service.

No polling. No callback hell. No message broker. Each request-reply pair is a single durable step.

<!-- split -->

Sequential request-reply with per-service timeout and retry. All state is durable — crashes mid-request resume exactly where they left off.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Retry until you get an answer"

The first attempt times out. The second attempt succeeds in 350ms. Without retry, you'd have reported a failure. With durable retry, you got the data.

A for-loop wraps each request attempt. Each iteration sends the request, waits for the reply, and races against the deadline. The loop is durable — even if the process crashes between retries, it picks up at the right iteration.

<!-- split -->

Retry is just a loop around request + wait + timeout. Each iteration is its own durable checkpoint. Crash between attempt 1 and attempt 2? Resume at attempt 2.

No retry library. No exponential backoff config. No dead letter queue for the retry itself. Just a loop, a send, and a sleep.

<!-- split -->

The simplest reliable RPC pattern: send, wait, timeout, retry, collect. All durable. All resumable.

Explore the interactive demo on v0: {v0_link}
