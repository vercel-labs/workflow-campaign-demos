# Approval Gate - Workflow DevKit Example

This example demonstrates the **"Signal + timer" pattern** using Workflow DevKit. It shows how to implement human-in-the-loop approval workflows with deterministic hook tokens and timeout behavior.

## Features

- **Deterministic Hook Tokens**: Hook tokens are derived from order IDs, allowing external systems to construct them
- **Promise.race Timeout Pattern**: Combines hook awaiting with `sleep()` for configurable timeout behavior
- **Type-safe Payloads**: Uses `defineHook<T>()` for typed approval payloads
- **External Resume**: Workflows can be resumed from any API route using the hook token

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Start an approval workflow:
   ```bash
   curl -X POST http://localhost:3000/api/start \
     -H "Content-Type: application/json" \
     -d '{"orderId": "order_123", "timeout": "30s"}'
   ```

4. Approve or reject before timeout:
   ```bash
   # Approve
   curl -X POST http://localhost:3000/api/approve \
     -H "Content-Type: application/json" \
     -d '{"token": "order_approval:order_123", "approved": true, "comment": "Approved!", "approvedBy": "manager@example.com"}'

   # Or reject
   curl -X POST http://localhost:3000/api/approve \
     -H "Content-Type: application/json" \
     -d '{"token": "order_approval:order_123", "approved": false, "comment": "Rejected - out of stock"}'
   ```

## API Reference

### POST /api/start

Starts a new approval workflow for an order.

**Request Body:**
```json
{
  "orderId": "order_123",
  "timeout": "30s"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `orderId` | string | Yes | - | Unique identifier for the order |
| `timeout` | string | No | `"30s"` | Duration to wait before timeout (e.g., `"30s"`, `"5m"`, `"24h"`) |

**Response:**
```json
{
  "message": "Approval workflow started",
  "runId": "wfr_abc123",
  "orderId": "order_123",
  "timeout": "30s",
  "approvalToken": "order_approval:order_123"
}
```

### POST /api/approve

Resumes a waiting workflow with an approval decision.

**Request Body:**
```json
{
  "token": "order_approval:order_123",
  "approved": true,
  "comment": "Looks good!",
  "approvedBy": "manager@example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The hook token (format: `order_approval:{orderId}`) |
| `approved` | boolean | Yes | `true` to approve, `false` to reject |
| `comment` | string | No | Optional comment or reason |
| `approvedBy` | string | No | Email or identifier of the approver |

**Response:**
```json
{
  "success": true,
  "message": "Order approved",
  "runId": "wfr_abc123",
  "token": "order_approval:order_123",
  "approved": true,
  "comment": "Looks good!"
}
```

## Workflow Outcomes

The workflow has three possible outcomes:

1. **Approved**: The order is approved and fulfilled
2. **Rejected**: The order is rejected and cancelled
3. **Timeout**: No decision was made within the timeout period, order is cancelled

## Code Patterns

### Deterministic Token Pattern

```typescript
// Token is derived from orderId, allowing external systems to construct it
const hook = orderApprovalHook.create({
  token: `order_approval:${orderId}`,
});
```

### Promise.race Timeout Pattern

```typescript
const result = await Promise.race([
  hook.then((payload) => ({ type: "approval", payload })),
  sleep(timeout).then(() => ({ type: "timeout", payload: null })),
]);
```

### Type-safe Hook Definition

```typescript
import { defineHook } from "workflow";

interface ApprovalPayload {
  approved: boolean;
  comment?: string;
  approvedBy?: string;
}

export const orderApprovalHook = defineHook<ApprovalPayload>();
```

## Use Cases

- Order approvals in e-commerce
- Expense report approvals
- Document review workflows
- Multi-step approval chains
- Any human-in-the-loop process with timeouts

## Learn More

- [Workflow DevKit Docs](https://useworkflow.dev/docs)
- [Hooks API Reference](https://useworkflow.dev/docs/api-reference/workflow/create-hook)
- [Sleep API Reference](https://useworkflow.dev/docs/api-reference/workflow/sleep)
