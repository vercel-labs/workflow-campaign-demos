# Fan-Out Notifications Demo

Broadcast an incident alert to Slack, Email, SMS, and PagerDuty in parallel using `Promise.allSettled()`.

## Code Paths

### Real Workflow Path (production)

```
POST /api/fan-out
  → start(incidentFanOut, [incidentId, message, failChannels])
  → returns { runId }

GET /api/run/[runId]
  → getRun(runId) → returns run metadata (status, timestamps)

GET /api/readable/[runId]
  → getRun(runId).getReadable() → SSE stream of workflow events
```

**Files:**

| File | Role |
|------|------|
| `workflows/incident-fanout.ts` | Workflow orchestration (`"use workflow"`) + step functions (`"use step"`) |
| `app/api/fan-out/route.ts` | `start()` from `workflow/api` |
| `app/api/run/[runId]/route.ts` | `getRun()` from `workflow/api` |
| `app/api/readable/[runId]/route.ts` | `run.getReadable()` SSE streaming |

### Mock Demo Path (interactive UI)

```
User clicks "Dispatch Alert"
  → POST /api/mock/start { incidentId, message, failChannels }
  → creates in-memory run with channel timings
  → returns { runId }

Polling loop (every 150ms)
  → GET /api/mock/status?runId=...
  → calculates snapshot from elapsed time:
      channels transition: "sending" → "sent" or "failed"
      run transitions: "fan_out" → "aggregating" → "done"
  → returns snapshot to client

Client updates:
  → buildHighlightState(snapshot) → active lines + gutter marks
  → FanOutCodeWorkbench re-renders with highlight changes
  → polling stops when status === "done"
```

**Files:**

| File | Role |
|------|------|
| `app/components/demo.tsx` | Client state machine, polling, highlight computation |
| `app/api/mock/start/route.ts` | Creates mock run |
| `app/api/mock/status/route.ts` | Returns time-based snapshot |
| `app/api/mock/store.ts` | In-memory store + `buildMockFanOutSnapshot()` |
| `app/api/mock/api.ts` | Shared response helpers |

### Mock Timing

| Channel | Duration | Order |
|---------|----------|-------|
| Slack | 650ms | 1st to complete |
| PagerDuty | 750ms | 2nd |
| Email | 900ms | 3rd |
| SMS | 1150ms | 4th (last) |
| Aggregate phase | +500ms after last channel | |

### Code Highlighting Path

```
Server (page.tsx)
  → define workflowCode + stepCode strings (with directive interpolation)
  → highlightCodeToHtmlLines(code) — Prism tokenization → HTML string[]
  → buildWorkflowLineMap(code) → { allSettled, deliveries, summary, returnResult }
  → buildStepLineMap(code) → full function blocks per channel
  → buildStepErrorLineMap(code) → throw line per channel
  → buildStepSuccessLineMap(code) → return line per channel
  → pass all as props to <FanOutDemo />

Client (demo.tsx)
  → buildHighlightState(snapshot, maps) → HighlightState
  → pass to <FanOutCodeWorkbench />

Render (fanout-code-workbench.tsx)
  → two <CodePane /> side-by-side
  → each line: active highlight (border + bg) + gutter mark (SVG ✓ or ✗)
```

### State Machine Phases

```
IDLE (snapshot = null)
  │ click "Dispatch Alert"
  ↓
FAN_OUT (0 → ~1150ms)
  │ tone: amber
  │ workflow pane: allSettled lines glow
  │ step pane: traces active channel, marks completed ones
  │ channels transition sending → sent/failed as time passes
  ↓
AGGREGATING (~1150ms → ~1650ms)
  │ tone: cyan
  │ workflow pane: deliveries + summary lines glow
  │ step pane: all channels marked (✓ or ✗)
  ↓
DONE (≥ ~1650ms)
  │ tone: green (all ok) or red (any failed)
  │ both panes: no active glow, all gutter marks shown
  │ polling stops
  ↓
IDLE (click "Reset Demo")
```

### Highlight Tones

| Phase | Tone | Border | Background |
|-------|------|--------|------------|
| Fan-out (sending) | amber | `border-amber-700` | `bg-amber-700/15` |
| Aggregating | cyan | `border-cyan-700` | `bg-cyan-700/15` |
| Done (all ok) | green | `border-green-700` | `bg-green-700/15` |
| Done (any failed) | red | `border-red-700` | `bg-red-700/15` |

### Gutter Marks

- **Green ✓** on `return { providerId: ... }` line → channel sent successfully
- **Red ✗** on `throw new Error(...)` line → channel failed
- Marks fade in (`opacity-0 → opacity-1`, 500ms transition)
- On removal, marks fade out preserving their last shape/color via `prevMarkRef`

## Shared Files

These files come from `_shared/` at the project root:

| File | Source | Method |
|------|--------|--------|
| `next.config.ts` | `_shared/next.config.ts` | symlink |
| `tsconfig.json` | `_shared/tsconfig.json` | symlink |
| `postcss.config.mjs` | `_shared/postcss.config.mjs` | symlink |
| `app/globals.css` | `_shared/globals.css` | copy (has `@import`) |
| `app/components/code-highlight-server.ts` | `_shared/code-highlight-server.ts` | copy (has npm imports) |
