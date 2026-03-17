---
slug: retryable-rate-limit
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retryable-rate-limit
primitive: RetryableError with retryAfter
pick: null
---

# Retryable Rate Limit — CRM Contact Sync

Sync a contact to an external CRM API, automatically retrying when the API returns 429 with a retry-after header.

## Variant A — "The retry-after header nobody reads"

You hit the CRM API. It returns 429. The `retry-after` header says 30 seconds. Now you need to parse the header, store retry state, schedule a delayed job, and hope the worker picks it up at the right time.

`RetryableError` with a `retryAfter` property handles the entire thing. Throw it, and the runtime durably pauses for exactly the requested duration.

<!-- split -->

Catch a 429. Read the `retry-after` header. Throw `new RetryableError("Rate limited", { retryAfter })`. The workflow pauses and resumes on schedule, surviving restarts and redeployments.

`RetryableError` vs `FatalError` — that's the entire retry vocabulary. Retryable means try again. Fatal means stop permanently.

<!-- split -->

No backoff library. No retry queue. No scheduler. No timer service. Three lines of retry logic and the infrastructure does the waiting.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Let the API tell you when to come back"

Exponential backoff guesses when to retry. The API already knows. A 429 with `retry-after: 30` is the server telling you exactly when your request will succeed. Why calculate what you've already been told?

`RetryableError` accepts a `retryAfter` duration directly from the response header. The workflow sleeps for exactly that long, durably.

<!-- split -->

The durable pause survives anything. Redeploy during the 30-second wait? The workflow resumes at the right moment. Server restart? Same thing. The retry timing is persisted, not held in memory.

When the workflow wakes up, the step re-executes. If the API returns another 429, throw another `RetryableError`. If it succeeds, move on. If it returns a permanent error, throw `FatalError`.

<!-- split -->

No exponential backoff library. No jitter calculations. No retry state in Redis. The API says when, `RetryableError` waits exactly that long, and the workflow resumes on schedule.

Explore the interactive demo on v0: {v0_link}

## Variant C — "429s are a workflow problem, not a queue problem"

Most retry systems shove the failed request into a delayed queue, add a scheduler to re-enqueue it, and pray the timing works out. Rate limits become an infrastructure problem spread across three services.

`RetryableError` keeps the retry inside the workflow. Throw it with `retryAfter` and the step pauses in place. No external queue. No scheduler. No re-enqueue.

<!-- split -->

The workflow is the queue. The durable runtime is the scheduler. When the `retryAfter` duration expires, the step picks up exactly where it left off. The retry state lives in the workflow log, not in Redis or a database table.

Hit another 429? Throw another `RetryableError`. API returns a permanent 403? Throw `FatalError` and stop. Two error types cover every retry scenario.

<!-- split -->

No delayed job queue. No retry scheduler. No backoff configuration. No retry count tracking. The workflow pauses, the workflow resumes, and the retry logic is three lines in a catch block.

Explore the interactive demo on v0: {v0_link}
