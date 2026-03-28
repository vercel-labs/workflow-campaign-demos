// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import type { ComponentType } from "react";

export type NativeDemoRouteKind = "start" | "readable" | "extra";

export type NativeDemo = {
  title: string;
  workflowId: string;
  uiReady: boolean;
  apiRoutes: Array<{ route: string; kind: NativeDemoRouteKind }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: () => Promise<{ default: ComponentType<any> }>;
};

export const nativeDemos = {
  "aggregator": {
    title: "Aggregator",
    workflowId: "aggregator/workflows/aggregator.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/aggregator", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/aggregator/signal", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/aggregator-native"),
  },
  "approval-chain": {
    title: "Approval-Chain",
    workflowId: "approval-chain/workflows/approval-chain.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/approval-chain", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/approval-chain/approve", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/approval-chain-native"),
  },
  "approval-gate": {
    title: "Approval-Gate",
    workflowId: "approval-gate/workflows/approval-gate.ts",
    uiReady: true,
    apiRoutes: [
      { route: "/api/approval-gate", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/approval-gate/approve", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/approval-gate-native"),
  },
  "async-request-reply": {
    title: "Async-Request-Reply",
    workflowId: "async-request-reply/workflows/async-request-reply.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/async-request-reply", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/async-request-reply/run/[runId]", kind: "extra" as const },
      { route: "/api/async-request-reply/webhook/[token]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/async-request-reply-native"),
  },
  "batch-processor": {
    title: "Batch-Processor",
    workflowId: "batch-processor/workflows/batch-processor.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/batch-processor", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/batch-processor-native"),
  },
  "bulkhead": {
    title: "Bulkhead",
    workflowId: "bulkhead/workflows/bulkhead.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/bulkhead", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/bulkhead-native"),
  },
  "cancellable-export": {
    title: "Cancellable-Export",
    workflowId: "cancellable-export/workflows/report-generator.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/cancellable-export", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/cancellable-export/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/cancellable-export-native"),
  },
  "choreography": {
    title: "Choreography",
    workflowId: "choreography/workflows/choreography.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/choreography", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/choreography/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/choreography-native"),
  },
  "circuit-breaker": {
    title: "Circuit-Breaker",
    workflowId: "circuit-breaker/workflows/circuit-breaker.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/circuit-breaker", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/circuit-breaker-native"),
  },
  "claim-check": {
    title: "Claim-Check",
    workflowId: "claim-check/workflows/claim-check.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/claim-check", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/claim-check/upload", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/claim-check-native"),
  },
  "competing-consumers": {
    title: "Competing-Consumers",
    workflowId: "competing-consumers/workflows/competing-consumers.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/competing-consumers", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/competing-consumers-native"),
  },
  "content-based-router": {
    title: "Content-Based-Router",
    workflowId: "content-based-router/workflows/content-based-router.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/content-based-router", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/content-based-router-native"),
  },
  "content-enricher": {
    title: "Content-Enricher",
    workflowId: "content-enricher/workflows/content-enricher.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/content-enricher", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/content-enricher/enrich", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/content-enricher-native"),
  },
  "correlation-identifier": {
    title: "Correlation-Identifier",
    workflowId: "correlation-identifier/workflows/correlation-identifier.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/correlation-identifier", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/correlation-identifier-native"),
  },
  "dead-letter-queue": {
    title: "Dead-Letter-Queue",
    workflowId: "dead-letter-queue/workflows/dead-letter-queue.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/dead-letter-queue", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/dead-letter-queue-native"),
  },
  "detour": {
    title: "Detour",
    workflowId: "detour/workflows/detour.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/detour", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/detour-native"),
  },
  "event-gateway": {
    title: "Event-Gateway",
    workflowId: "event-gateway/workflows/event-gateway.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/event-gateway", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/event-gateway/signal", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/event-gateway-native"),
  },
  "event-sourcing": {
    title: "Event-Sourcing",
    workflowId: "event-sourcing/workflows/event-sourcing.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/event-sourcing", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/event-sourcing-native"),
  },
  "fan-out": {
    title: "Fan-Out",
    workflowId: "fan-out/workflows/incident-fanout.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/fan-out", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/fan-out-native"),
  },
  "guaranteed-delivery": {
    title: "Guaranteed-Delivery",
    workflowId: "guaranteed-delivery/workflows/guaranteed-delivery.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/guaranteed-delivery", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/guaranteed-delivery-native"),
  },
  "hedge-request": {
    title: "Hedge-Request",
    workflowId: "hedge-request/workflows/hedge-request.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/hedge-request", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/hedge-request-native"),
  },
  "idempotent-receiver": {
    title: "Idempotent-Receiver",
    workflowId: "idempotent-receiver/workflows/idempotent-receiver.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/idempotent-receiver", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/idempotent-receiver/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/idempotent-receiver-native"),
  },
  "map-reduce": {
    title: "Map-Reduce",
    workflowId: "map-reduce/workflows/map-reduce.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/map-reduce", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/map-reduce-native"),
  },
  "message-filter": {
    title: "Message-Filter",
    workflowId: "message-filter/workflows/order-filter.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/message-filter", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/message-filter-native"),
  },
  "message-history": {
    title: "Message-History",
    workflowId: "message-history/workflows/message-history.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/message-history", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/message-history/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/message-history-native"),
  },
  "message-translator": {
    title: "Message-Translator",
    workflowId: "message-translator/workflows/message-translator.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/message-translator", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/message-translator-native"),
  },
  "namespaced-streams": {
    title: "Namespaced-Streams",
    workflowId: "namespaced-streams/workflows/namespaced-streams.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/namespaced-streams", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/namespaced-streams-native"),
  },
  "normalizer": {
    title: "Normalizer",
    workflowId: "normalizer/workflows/normalizer.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/normalizer", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/normalizer-native"),
  },
  "onboarding-drip": {
    title: "Onboarding-Drip",
    workflowId: "onboarding-drip/workflows/onboarding-drip.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/onboarding-drip", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/onboarding-drip/onboarding", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/onboarding-drip-native"),
  },
  "pipeline": {
    title: "Pipeline",
    workflowId: "pipeline/workflows/pipeline.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/pipeline", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/pipeline-native"),
  },
  "priority-queue": {
    title: "Priority-Queue",
    workflowId: "priority-queue/workflows/priority-queue.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/priority-queue", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/priority-queue-native"),
  },
  "process-manager": {
    title: "Process-Manager",
    workflowId: "process-manager/workflows/process-manager.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/process-manager", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/process-manager/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/process-manager-native"),
  },
  "publish-subscribe": {
    title: "Publish-Subscribe",
    workflowId: "publish-subscribe/workflows/publish-subscribe.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/publish-subscribe", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/publish-subscribe-native"),
  },
  "recipient-list": {
    title: "Recipient-List",
    workflowId: "recipient-list/workflows/recipient-list.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/recipient-list", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/recipient-list-native"),
  },
  "request-reply": {
    title: "Request-Reply",
    workflowId: "request-reply/workflows/request-reply.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/request-reply", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/request-reply-native"),
  },
  "resequencer": {
    title: "Resequencer",
    workflowId: "resequencer/workflows/resequencer.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/resequencer", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/resequencer/event", kind: "extra" as const },
      { route: "/api/resequencer/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/resequencer-native"),
  },
  "retry-backoff": {
    title: "Retry-Backoff",
    workflowId: "retry-backoff/workflows/retry-backoff.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/retry-backoff", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/retry-backoff-native"),
  },
  "retryable-rate-limit": {
    title: "Retryable-Rate-Limit",
    workflowId: "retryable-rate-limit/workflows/retryable-rate-limit.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/retryable-rate-limit", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/retryable-rate-limit/start", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/retryable-rate-limit-native"),
  },
  "routing-slip": {
    title: "Routing-Slip",
    workflowId: "routing-slip/workflows/routing-slip.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/routing-slip", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/routing-slip-native"),
  },
  "saga": {
    title: "Saga",
    workflowId: "saga/workflows/subscription-upgrade-saga.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/saga", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/saga-native"),
  },
  "scatter-gather": {
    title: "Scatter-Gather",
    workflowId: "scatter-gather/workflows/scatter-gather.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/scatter-gather", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/scatter-gather-native"),
  },
  "scheduled-digest": {
    title: "Scheduled-Digest",
    workflowId: "scheduled-digest/workflows/scheduled-digest.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/scheduled-digest", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/scheduled-digest/event", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/scheduled-digest-native"),
  },
  "scheduler-agent-supervisor": {
    title: "Scheduler-Agent-Supervisor",
    workflowId: "scheduler-agent-supervisor/workflows/scheduler-agent-supervisor.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/scheduler-agent-supervisor", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/scheduler-agent-supervisor-native"),
  },
  "splitter": {
    title: "Splitter",
    workflowId: "splitter/workflows/order-splitter.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/splitter", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/splitter-native"),
  },
  "status-poller": {
    title: "Status-Poller",
    workflowId: "status-poller/workflows/status-poller.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/status-poller", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/status-poller-native"),
  },
  "throttle": {
    title: "Throttle",
    workflowId: "throttle/workflows/throttle.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/throttle", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/throttle-native"),
  },
  "transactional-outbox": {
    title: "Transactional-Outbox",
    workflowId: "transactional-outbox/workflows/transactional-outbox.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/transactional-outbox", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/transactional-outbox/run/[runId]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/transactional-outbox-native"),
  },
  "wakeable-reminder": {
    title: "Wakeable-Reminder",
    workflowId: "wakeable-reminder/workflows/wakeable-reminder.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/wakeable-reminder", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/wakeable-reminder/wake", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/wakeable-reminder-native"),
  },
  "webhook-basics": {
    title: "Webhook-Basics",
    workflowId: "webhook-basics/workflows/payment-webhook.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/webhook-basics", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
      { route: "/api/webhook-basics/webhook/[token]", kind: "extra" as const },
    ],
    component: () => import("@/app/components/demos/webhook-basics-native"),
  },
  "wire-tap": {
    title: "Wire-Tap",
    workflowId: "wire-tap/workflows/wire-tap.ts",
    uiReady: false,
    apiRoutes: [
      { route: "/api/wire-tap", kind: "start" as const },
      { route: "/api/readable/[runId]", kind: "readable" as const },
    ],
    component: () => import("@/app/components/demos/wire-tap-native"),
  }
} satisfies Record<string, NativeDemo>;
