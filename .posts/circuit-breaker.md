---
slug: circuit-breaker
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-circuit-breaker
primitive: sleep() for cooldown
pick: null
---

# Circuit Breaker — Stop Cascading Failures

Monitor failures, trip the circuit to stop cascading damage. After a cooldown, test one request. If it passes, close the circuit.

## Variant A — "Stop hitting a dead API"


Your upstream API is down. You keep retrying. Now you're DDoS-ing a service that's trying to recover.

A circuit breaker stops the bleeding. Traditional approach: a circuit breaker library, a Redis counter, and a TTL key.

With WDK it's a counter and a `sleep()`:

```ts
import { sleep } from "workflow";

async function circuitBreakerFlow(serviceId, maxRequests) {
  "use workflow";

  let state = "closed";
  let consecutiveFailures = 0;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await sleep("3000ms"); // cooldown — real wall time, zero compute
      state = "half-open";
    }

    const success = await callService(serviceId, i);

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") state = "closed";
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        state = "open";
        consecutiveFailures = 0;
      }
    }
  }
}
```

<!-- split -->

Three states: closed (normal), open (blocked), half-open (testing). The transitions are just if-statements.

`sleep()` handles the cooldown. It pauses for real wall time, zero compute, and survives deploys. Crash during cooldown? It picks up with the remaining time.

<!-- split -->

No circuit breaker library. No Redis counter. No TTL key. A for-loop, a counter, and a durable sleep.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The 3-state loop"

Closed → Open → Half-open → Closed.

That's the circuit breaker pattern. Traditionally you'd wire up a library, a shared state store, and a TTL-based reset.

In WDK it's a loop with durable `sleep()`:

```ts
import { sleep } from "workflow";

async function circuitBreakerFlow(serviceId, maxRequests) {
  "use workflow";

  let state = "closed";
  let consecutiveFailures = 0;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await sleep("3000ms"); // cooldown — real wall time, zero compute
      state = "half-open";
    }

    const success = await callService(serviceId, i);

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") state = "closed";
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        state = "open";
        consecutiveFailures = 0;
      }
    }
  }
}
```

<!-- split -->

Failures increment a counter inside the workflow. Hit the threshold? Open the circuit and `sleep("30s")`. Real wall time, zero cost.

After the cooldown, try one request. If it works, reset the counter. If not, sleep again. All state lives in the workflow itself.

<!-- split -->

No Redis. No shared state. No library dependency. The circuit state lives in the workflow and survives restarts.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Protect your downstream"

When a dependency fails, the worst thing you can do is keep calling it.

A circuit breaker gives it room to recover. Traditionally that means a library, a distributed counter, and careful TTL management.

WDK makes it trivial -- a counter and a `sleep()`:

```ts
import { sleep } from "workflow";

async function circuitBreakerFlow(serviceId, maxRequests) {
  "use workflow";

  let state = "closed";
  let consecutiveFailures = 0;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await sleep("3000ms"); // cooldown — real wall time, zero compute
      state = "half-open";
    }

    const success = await callService(serviceId, i);

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") state = "closed";
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        state = "open";
        consecutiveFailures = 0;
      }
    }
  }
}
```

<!-- split -->

`sleep("30s")` is a real 30-second pause. No compute. No polling. The workflow resumes exactly when the cooldown expires.

Crash during the cooldown? It picks up with the remaining time. No orphaned timers. No stale state.

<!-- split -->

No external state. No TTL keys. No circuit breaker dependency. Just TypeScript that pauses and resumes.

Explore the interactive demo on v0: {v0_link}
