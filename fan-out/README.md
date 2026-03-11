# Fan-Out Notifications Demo

Broadcast an incident alert to Slack, Email, SMS, and PagerDuty in parallel using `Promise.allSettled()`. Each channel runs as a separate `"use step"` function with full retry semantics. The interactive UI lets you toggle channels between three failure modes to explore how the workflow handles partial failures.

## How It Works

```
POST /api/fan-out
  → start(incidentFanOut, [incidentId, message, failures])
  → returns { runId }

GET /api/readable/[runId]
  → getRun(runId).getReadable() → SSE stream of ChannelEvent objects
```

Steps stream progress events via `getWritable<ChannelEvent>()` from inside `"use step"` functions. The client connects to the SSE stream and appends each event to an execution log in real time.

## Files

| File | Role |
|------|------|
| `workflows/incident-fanout.ts` | Workflow (`"use workflow"`) + step functions (`"use step"`) |
| `app/api/fan-out/route.ts` | `start()` from `workflow/api` — validates and enqueues |
| `app/api/readable/[runId]/route.ts` | `run.getReadable()` piped through SSE transform |
| `app/page.tsx` | Server component — reads workflow source, builds line maps, highlights code |
| `app/components/demo.tsx` | Client — SSE connection, state accumulator, execution log, controls |
| `app/components/fanout-code-workbench.tsx` | Two-pane code viewer with active line + gutter mark rendering |

## Failure Modes

The UI provides per-channel cycling buttons with three states:

| Mode | Color | Backend Behavior |
|------|-------|-----------------|
| **Pass** | Gray | Channel succeeds normally |
| **Transient** (T) | Amber | Throws `Error` on attempt 1 → SDK auto-retries → succeeds on attempt 2 |
| **Permanent** (P) | Red | Throws `FatalError` → no retry → stays failed in `Promise.allSettled()` |

This lets you demo both the SDK's automatic retry path and the `Promise.allSettled()` partial failure path in one run.

## Channel Timing

| Channel | Simulated Latency | Typical Completion Order |
|---------|------------------|--------------------------|
| Slack | 650ms | 1st |
| PagerDuty | 750ms | 2nd |
| Email | 900ms | 3rd |
| SMS | 1150ms | 4th |
| Aggregate phase | +500ms after last channel | |

## State Machine

```
IDLE (no run)
  │ click "Dispatch Alert"
  ↓
FAN_OUT (tone: amber)
  │ Promise.allSettled() running all 4 channels in parallel
  │ Channels stream: channel_sending → channel_sent / channel_retrying / channel_failed
  ↓
AGGREGATING (tone: cyan)
  │ aggregateResults() counting successes and failures
  ↓
DONE (tone: green if all ok, red if any failed)
  │ Summary recorded, execution log complete
  ↓
IDLE (click "Reset Demo")
```

## Execution Log

The execution log is **append-only** — each `ChannelEvent` from the workflow stream is timestamped and appended as it arrives. Entries are colored by outcome:

| Color | Meaning |
|-------|---------|
| Gray | Neutral (queued, sending, message) |
| Green | Channel sent successfully |
| Amber | Retrying / retry succeeded |
| Red | Channel permanently failed |
| Cyan | Aggregation phase |

## Code Workbench Highlights

### Active Line Highlighting

The current workflow phase determines which lines glow in the two-pane code viewer:

| Phase | Workflow Pane | Step Pane |
|-------|--------------|-----------|
| Fan-out | `Promise.allSettled()` block | Active channel's step function |
| Aggregating | `deliveries` + `summary` lines | — |
| Done | — | — |

### Gutter Marks

Lines get a full-width colored background + left border + icon based on outcome:

| Mark | Color | Icon | Points At |
|------|-------|------|-----------|
| Success | Green | ✓ checkmark | `return { providerId }` |
| Retry | Amber | ↻ circular arrow | `throw new Error(...)` (transient) |
| Fail | Red | ✗ cross | `throw new FatalError(...)` (permanent) |

Marks fade in/out with a 500ms opacity transition, preserving their last shape via `prevMarkRef`.
