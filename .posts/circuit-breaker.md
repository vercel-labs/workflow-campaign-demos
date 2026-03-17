---
slug: circuit-breaker
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-circuit-breaker
primitive: sleep() for cooldown
pick: null
---

# Circuit Breaker — Stop Cascading Failures

Monitor failures, trip the circuit to stop cascading damage. After a cooldown, test one request. If it passes, close the circuit.

## Variant A — "Stop DDoS-ing your own dependency"

Your upstream API is down. You keep retrying. Now you're DDoS-ing a service that's trying to recover.

A circuit breaker stops the bleeding, but traditionally that means a library, a Redis counter, and a TTL key.

`sleep()` replaces all of that with a durable cooldown.

<!-- split -->

Three consecutive failures open the circuit. `sleep()` pauses for real wall time with zero compute. When the cooldown expires, one test request goes through.

If the test succeeds, the circuit closes and traffic resumes. If it fails, `sleep()` starts another cooldown. Crash during the cooldown? It picks up with the remaining time.

<!-- split -->

No circuit breaker library. No Redis counter. No TTL key. The circuit state lives in the workflow itself and survives restarts.

A for-loop, a counter, and a durable `sleep()` give you the full closed/open/half-open pattern.

Explore the interactive demo on v0: {v0_link}

## Variant B — "A cooldown that survives a deploy"

You trip the circuit and start a 30-second cooldown. Then you deploy. The in-memory timer is gone. The circuit resets to closed and immediately hammers the failing service again.

Traditional circuit breakers store state in Redis or a shared cache. That adds a dependency to the thing protecting you from dependency failures.

`sleep()` is durable. Deploy, crash, restart — the cooldown resumes with the remaining time. No external state store required.

<!-- split -->

The circuit state is the workflow state. Closed, open, half-open — all represented by where the workflow is in its execution. A counter tracks failures. `sleep()` holds the open state. A single test request probes half-open.

If the probe succeeds, the loop continues. If it fails, `sleep()` starts another cooldown. The workflow is the state machine.

<!-- split -->

No Redis. No TTL keys. No shared cache that itself could fail. The circuit breaker is a loop with a counter and a `sleep()`, and it survives anything the infrastructure throws at it.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Closed, open, half-open in a for-loop"

The circuit breaker pattern has three states: closed, open, half-open. Most implementations need a state machine, a timer, and a probe mechanism. That means a library or a custom class with careful concurrency handling.

A for-loop with `sleep()` gives you all three states implicitly. Closed is the loop running normally. Open is `sleep()` holding execution. Half-open is the single request after the sleep returns.

<!-- split -->

Count consecutive failures in a variable. When the threshold hits, call `sleep()` for the cooldown period. When sleep returns, try one request. Success resets the counter and the loop continues in the closed state. Failure triggers another `sleep()`.

The pattern emerges from the control flow, not from a state machine definition. The runtime handles durability.

<!-- split -->

No state enum. No transition table. No circuit breaker library to configure. Three states from a counter, a conditional, and a `sleep()`. The full pattern in a few lines of workflow code.

Explore the interactive demo on v0: {v0_link}
