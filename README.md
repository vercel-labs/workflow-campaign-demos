# Onboarding Drip Campaign

A multi-day email drip campaign workflow built with Vercel Workflow DevKit. This example demonstrates how to use `sleep()` to schedule emails over the course of a week without consuming compute resources during wait periods.

## What This Example Demonstrates

- **Durable sleep**: Using `sleep()` with duration strings like `"1d"`, `"2d"`, `"4d"` to pause workflow execution for days without consuming resources
- **Multi-step workflows**: Breaking down the campaign into discrete steps with `"use step"` directive
- **Workflow orchestration**: Using `"use workflow"` directive to define the main workflow function
- **API integration**: Starting workflows from a Next.js API route using `start()`

## Email Schedule

| Day | Email Type | Description |
|-----|------------|-------------|
| 0 | Welcome | Immediate welcome email when user signs up |
| 1 | Getting Started | Tips and guidance for new users |
| 3 | Feature Highlights | Showcase key features |
| 7 | Follow-up | Request feedback and offer help |

## Project Structure

```
01-onboarding-drip/
├── app/
│   ├── api/
│   │   └── onboarding/
│   │       └── route.ts      # API endpoint to start the workflow
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── workflows/
│   └── onboarding-drip.ts    # The drip campaign workflow
├── next.config.ts            # Uses withWorkflow() wrapper
├── package.json
└── tsconfig.json
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

3. Start an onboarding drip campaign:

```bash
curl -X POST http://localhost:3000/api/onboarding \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## API Reference

### POST /api/onboarding

Start a new onboarding drip campaign for a user.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "Onboarding drip campaign started",
  "runId": "run_abc123",
  "email": "user@example.com",
  "schedule": {
    "day0": "Welcome email (immediate)",
    "day1": "Getting started tips",
    "day3": "Feature highlights",
    "day7": "Follow-up and feedback request"
  }
}
```

## Key Concepts

### Duration Format

The `sleep()` function accepts duration strings in the format:

- `"7d"` - 7 days
- `"24h"` - 24 hours
- `"30m"` - 30 minutes
- `"10s"` - 10 seconds
- `"250ms"` - 250 milliseconds

### Workflow Directive

Functions that orchestrate steps must include the `"use workflow"` directive:

```typescript
export async function runOnboardingDrip(email: string) {
  "use workflow";
  // ...
}
```

### Step Directive

Individual operations that should be tracked and can be retried must include the `"use step"` directive:

```typescript
async function sendWelcomeEmail(email: string) {
  "use step";
  // ...
}
```

## Production Integration

To send real emails, integrate with your email provider (Resend, SendGrid, Postmark, etc.) in each step function:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(email: string) {
  "use step";

  await resend.emails.send({
    from: 'onboarding@yourapp.com',
    to: email,
    subject: 'Welcome to Our App!',
    html: '<h1>Welcome!</h1><p>We are excited to have you...</p>'
  });
}
```
