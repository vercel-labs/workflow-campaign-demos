# Cancellable Invoicing

A bulk invoice generation workflow with cancellation support built with Vercel Workflow DevKit. Spot wrong prices mid-batch? Cancel before more customers get billed incorrectly.

## What This Example Demonstrates

- **Run management**: Using `start()` to get a `Run` object with `runId`
- **Run retrieval**: Using `getRun(runId)` to access an existing run
- **Cancellation**: Using `run.cancel()` to stop a running workflow
- **Status checking**: Using `run.status`, `run.startedAt`, `run.completedAt` properties
- **Progress streaming**: Real-time progress updates via `getWritable()` and `run.readable`
- **Graceful interruption**: Sleep points where cancellation can occur cleanly

## Project Structure

```
05-cancellable-export/
├── app/
│   ├── api/
│   │   ├── start/
│   │   │   └── route.ts      # POST - Start invoicing workflow
│   │   ├── status/
│   │   │   └── route.ts      # GET - Check workflow status
│   │   ├── cancel/
│   │   │   └── route.ts      # POST - Cancel running workflow
│   │   └── stream/
│   │       └── [runId]/
│   │           └── route.ts  # GET - Stream progress (SSE)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── workflows/
│   └── report-generator.ts      # The report generation workflow
├── next.config.ts               # Uses withWorkflow() wrapper
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Run the development server:

```bash
pnpm dev
```

## API Reference

### POST /api/start

Start a new invoicing workflow.

**Request Body:**

```json
{
  "accountId": "acct_1",
  "total": 50,
  "delay": "1s"
}
```

| Parameter   | Type   | Default | Description                                   |
| ----------- | ------ | ------- | --------------------------------------------- |
| `accountId` | string | -       | Required. Account identifier                  |
| `total`     | number | 50      | Number of invoices to generate (1-10000)      |
| `delay`     | string | "1s"    | Delay between invoices (e.g., "500ms", "1s")  |

**Response:**

```json
{
  "runId": "run_abc123",
  "accountId": "acct_1",
  "total": 50,
  "delay": "1s",
  "message": "Invoice workflow started"
}
```

### GET /api/status

Check the status of a workflow run.

**Query Parameters:**

- `runId` (required): The workflow run ID

**Response:**

```json
{
  "runId": "run_abc123",
  "status": "running",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "completedAt": null
}
```

**Status Values:**

- `pending` - Workflow is queued but not started
- `running` - Workflow is currently executing
- `completed` - Workflow finished successfully
- `failed` - Workflow encountered an error
- `cancelled` - Workflow was cancelled

### POST /api/cancel

Cancel a running workflow.

**Request Body:**

```json
{
  "runId": "run_abc123"
}
```

**Response:**

```json
{
  "runId": "run_abc123",
  "message": "Workflow cancelled successfully",
  "previousStatus": "running",
  "currentStatus": "cancelled"
}
```

### GET /api/stream/[runId]

Stream real-time progress updates via Server-Sent Events (SSE).

**Response (SSE format):**

```
data: {"type":"progress","current":1,"total":50,"accountId":"acct_1","invoiceId":"INV-acct_1-0001","message":"Generated invoice 1 of 50"}

data: {"type":"progress","current":2,"total":50,"accountId":"acct_1","invoiceId":"INV-acct_1-0002","message":"Generated invoice 2 of 50"}

data: {"type":"complete","current":50,"total":50,"accountId":"acct_1","message":"Invoice batch completed: 50 invoices generated"}
```

## curl Commands

### Start invoicing (quick test with 10 invoices)

```bash
curl -X POST http://localhost:3000/api/start \
  -H "Content-Type: application/json" \
  -d '{"accountId": "acct_1", "total": 10, "delay": "500ms"}'
```

### Check workflow status

```bash
curl "http://localhost:3000/api/status?runId=YOUR_RUN_ID"
```

### Cancel a running workflow

```bash
curl -X POST http://localhost:3000/api/cancel \
  -H "Content-Type: application/json" \
  -d '{"runId": "YOUR_RUN_ID"}'
```

### Stream progress updates

```bash
curl -N "http://localhost:3000/api/stream/YOUR_RUN_ID"
```

## Complete Workflow Example

Here's a typical workflow for testing cancellation:

```bash
# Terminal 1: Start invoicing with slow delay
RUN_ID=$(curl -s -X POST http://localhost:3000/api/start \
  -H "Content-Type: application/json" \
  -d '{"accountId": "acct_1", "total": 20, "delay": "2s"}' | jq -r '.runId')

echo "Started run: $RUN_ID"

# Terminal 2: Watch progress (in another terminal)
curl -N "http://localhost:3000/api/stream/$RUN_ID"

# Terminal 3: Cancel after a few seconds (in another terminal)
sleep 5
curl -X POST http://localhost:3000/api/cancel \
  -H "Content-Type: application/json" \
  -d "{\"runId\": \"$RUN_ID\"}"

# Verify cancelled status
curl "http://localhost:3000/api/status?runId=$RUN_ID"
```

## Key Concepts

### Cancellation Behavior

- Cancellation is effective for `pending` or `running` workflows
- Already `completed`, `failed`, or `cancelled` workflows cannot be cancelled
- Cancellation occurs at sleep boundaries - the workflow will finish its current step before stopping
- Cancelled workflows have their status set to `cancelled` and `completedAt` timestamp is recorded

### Why This Matters

You're generating 1,000 invoices and realize the pricing table was wrong. Without cancellation, those invoices go out to customers with incorrect amounts. With `run.cancel()`, you stop the batch at the next sleep boundary — only the invoices already generated need correction, not all 1,000.
