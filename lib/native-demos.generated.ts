// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import type { ComponentType } from "react";

export type NativeDemoUiStatus = "native-ready" | "adapter-required" | "placeholder";
export type NativeDemoRouteKind = "start" | "readable" | "extra";

export type NativeDemo = {
  title: string;
  workflowId: string;
  uiStatus: NativeDemoUiStatus;
  uiReasons: string[];
  routeMap: {
    start: { original: string; gallery: string };
    readable: { original: string; gallery: string };
    extras: Record<string, string>;
  };
  apiRoutes: Array<{ route: string; kind: NativeDemoRouteKind }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: () => Promise<{ default: ComponentType<any> }>;
};

export const nativeDemos: Record<string, NativeDemo> = {
  "aggregator": {
    title: "Aggregator",
    workflowId: "aggregator/workflows/aggregator.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/signal->/api/aggregator/signal"],
    routeMap: {
      "start": {
        "original": "/api/aggregator",
        "gallery": "/api/aggregator"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/signal": "/api/aggregator/signal"
      }
    },
    apiRoutes: [
      {
        "route": "/api/aggregator",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/aggregator/signal",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/aggregator-native"),
  },
  "approval-chain": {
    title: "Approval-Chain",
    workflowId: "approval-chain/workflows/approval-chain.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/approve->/api/approval-chain/approve"],
    routeMap: {
      "start": {
        "original": "/api/approval-chain",
        "gallery": "/api/approval-chain"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/approve": "/api/approval-chain/approve"
      }
    },
    apiRoutes: [
      {
        "route": "/api/approval-chain",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/approval-chain/approve",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/approval-chain-native"),
  },
  "approval-gate": {
    title: "Approval-Gate",
    workflowId: "approval-gate/workflows/approval-gate.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/approve->/api/approval-gate/approve"],
    routeMap: {
      "start": {
        "original": "/api/approval-gate",
        "gallery": "/api/approval-gate"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/approve": "/api/approval-gate/approve"
      }
    },
    apiRoutes: [
      {
        "route": "/api/approval-gate",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/approval-gate/approve",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/approval-gate-native"),
  },
  "async-request-reply": {
    title: "Async-Request-Reply",
    workflowId: "async-request-reply/workflows/async-request-reply.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/async-request-reply",
        "gallery": "/api/async-request-reply"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/async-request-reply/run/[runId]",
        "/api/webhook/[token]": "/api/async-request-reply/webhook/[token]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/async-request-reply",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/async-request-reply/run/[runId]",
        "kind": "extra"
      },
      {
        "route": "/api/async-request-reply/webhook/[token]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/async-request-reply-native"),
  },
  "batch-processor": {
    title: "Batch-Processor",
    workflowId: "batch-processor/workflows/batch-processor.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/batch-processor",
        "gallery": "/api/batch-processor"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/batch-processor",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/batch-processor-native"),
  },
  "bulkhead": {
    title: "Bulkhead",
    workflowId: "bulkhead/workflows/bulkhead.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/bulkhead",
        "gallery": "/api/bulkhead"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/bulkhead",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/bulkhead-native"),
  },
  "cancellable-export": {
    title: "Cancellable-Export",
    workflowId: "cancellable-export/workflows/report-generator.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/cancellable-export",
        "gallery": "/api/cancellable-export"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/cancellable-export/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/cancellable-export",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/cancellable-export/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/cancellable-export-native"),
  },
  "choreography": {
    title: "Choreography",
    workflowId: "choreography/workflows/choreography.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/choreography",
        "gallery": "/api/choreography"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/choreography/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/choreography",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/choreography/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/choreography-native"),
  },
  "circuit-breaker": {
    title: "Circuit-Breaker",
    workflowId: "circuit-breaker/workflows/circuit-breaker.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/circuit-breaker",
        "gallery": "/api/circuit-breaker"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/circuit-breaker",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/circuit-breaker-native"),
  },
  "claim-check": {
    title: "Claim-Check",
    workflowId: "claim-check/workflows/claim-check.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/claim-check",
        "gallery": "/api/claim-check"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/claim-check/upload": "/api/claim-check/upload"
      }
    },
    apiRoutes: [
      {
        "route": "/api/claim-check",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/claim-check/upload",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/claim-check-native"),
  },
  "competing-consumers": {
    title: "Competing-Consumers",
    workflowId: "competing-consumers/workflows/competing-consumers.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/competing-consumers",
        "gallery": "/api/competing-consumers"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/competing-consumers",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/competing-consumers-native"),
  },
  "content-based-router": {
    title: "Content-Based-Router",
    workflowId: "content-based-router/workflows/content-based-router.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/content-based-router",
        "gallery": "/api/content-based-router"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/content-based-router",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/content-based-router-native"),
  },
  "content-enricher": {
    title: "Content-Enricher",
    workflowId: "content-enricher/workflows/content-enricher.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_start_route:/api/enrich->/api/content-enricher"],
    routeMap: {
      "start": {
        "original": "/api/enrich",
        "gallery": "/api/content-enricher"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/enrich": "/api/content-enricher/enrich"
      }
    },
    apiRoutes: [
      {
        "route": "/api/content-enricher",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/content-enricher/enrich",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/content-enricher-native"),
  },
  "correlation-identifier": {
    title: "Correlation-Identifier",
    workflowId: "correlation-identifier/workflows/correlation-identifier.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/correlation-identifier",
        "gallery": "/api/correlation-identifier"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/correlation-identifier",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/correlation-identifier-native"),
  },
  "dead-letter-queue": {
    title: "Dead-Letter-Queue",
    workflowId: "dead-letter-queue/workflows/dead-letter-queue.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/dead-letter-queue",
        "gallery": "/api/dead-letter-queue"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/dead-letter-queue",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/dead-letter-queue-native"),
  },
  "detour": {
    title: "Detour",
    workflowId: "detour/workflows/detour.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/detour",
        "gallery": "/api/detour"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/detour",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/detour-native"),
  },
  "event-gateway": {
    title: "Event-Gateway",
    workflowId: "event-gateway/workflows/event-gateway.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/signal->/api/event-gateway/signal"],
    routeMap: {
      "start": {
        "original": "/api/event-gateway",
        "gallery": "/api/event-gateway"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/signal": "/api/event-gateway/signal"
      }
    },
    apiRoutes: [
      {
        "route": "/api/event-gateway",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/event-gateway/signal",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/event-gateway-native"),
  },
  "event-sourcing": {
    title: "Event-Sourcing",
    workflowId: "event-sourcing/workflows/event-sourcing.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/event-sourcing",
        "gallery": "/api/event-sourcing"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/event-sourcing",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/event-sourcing-native"),
  },
  "fan-out": {
    title: "Fan-Out",
    workflowId: "fan-out/workflows/incident-fanout.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/fan-out",
        "gallery": "/api/fan-out"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/fan-out",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/fan-out-native"),
  },
  "guaranteed-delivery": {
    title: "Guaranteed-Delivery",
    workflowId: "guaranteed-delivery/workflows/guaranteed-delivery.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/guaranteed-delivery",
        "gallery": "/api/guaranteed-delivery"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/guaranteed-delivery",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/guaranteed-delivery-native"),
  },
  "hedge-request": {
    title: "Hedge-Request",
    workflowId: "hedge-request/workflows/hedge-request.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/hedge-request",
        "gallery": "/api/hedge-request"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/hedge-request",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/hedge-request-native"),
  },
  "idempotent-receiver": {
    title: "Idempotent-Receiver",
    workflowId: "idempotent-receiver/workflows/idempotent-receiver.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/idempotent-receiver",
        "gallery": "/api/idempotent-receiver"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/idempotent-receiver/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/idempotent-receiver",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/idempotent-receiver/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/idempotent-receiver-native"),
  },
  "map-reduce": {
    title: "Map-Reduce",
    workflowId: "map-reduce/workflows/map-reduce.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/map-reduce",
        "gallery": "/api/map-reduce"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/map-reduce",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/map-reduce-native"),
  },
  "message-filter": {
    title: "Message-Filter",
    workflowId: "message-filter/workflows/order-filter.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/message-filter",
        "gallery": "/api/message-filter"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/message-filter",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/message-filter-native"),
  },
  "message-history": {
    title: "Message-History",
    workflowId: "message-history/workflows/message-history.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/message-history",
        "gallery": "/api/message-history"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/message-history/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/message-history",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/message-history/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/message-history-native"),
  },
  "message-translator": {
    title: "Message-Translator",
    workflowId: "message-translator/workflows/message-translator.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/message-translator",
        "gallery": "/api/message-translator"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/message-translator",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/message-translator-native"),
  },
  "namespaced-streams": {
    title: "Namespaced-Streams",
    workflowId: "namespaced-streams/workflows/namespaced-streams.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/namespaced-streams",
        "gallery": "/api/namespaced-streams"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/namespaced-streams",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/namespaced-streams-native"),
  },
  "normalizer": {
    title: "Normalizer",
    workflowId: "normalizer/workflows/normalizer.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/normalizer",
        "gallery": "/api/normalizer"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/normalizer",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/normalizer-native"),
  },
  "onboarding-drip": {
    title: "Onboarding-Drip",
    workflowId: "onboarding-drip/workflows/onboarding-drip.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/onboarding",
        "gallery": "/api/onboarding-drip"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/onboarding": "/api/onboarding-drip/onboarding"
      }
    },
    apiRoutes: [
      {
        "route": "/api/onboarding-drip",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/onboarding-drip/onboarding",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/onboarding-drip-native"),
  },
  "pipeline": {
    title: "Pipeline",
    workflowId: "pipeline/workflows/pipeline.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/pipeline",
        "gallery": "/api/pipeline"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/pipeline",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/pipeline-native"),
  },
  "priority-queue": {
    title: "Priority-Queue",
    workflowId: "priority-queue/workflows/priority-queue.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/priority-queue",
        "gallery": "/api/priority-queue"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/priority-queue",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/priority-queue-native"),
  },
  "process-manager": {
    title: "Process-Manager",
    workflowId: "process-manager/workflows/process-manager.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/process-manager",
        "gallery": "/api/process-manager"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/process-manager/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/process-manager",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/process-manager/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/process-manager-native"),
  },
  "publish-subscribe": {
    title: "Publish-Subscribe",
    workflowId: "publish-subscribe/workflows/publish-subscribe.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/publish-subscribe",
        "gallery": "/api/publish-subscribe"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/publish-subscribe",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/publish-subscribe-native"),
  },
  "recipient-list": {
    title: "Recipient-List",
    workflowId: "recipient-list/workflows/recipient-list.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/recipient-list",
        "gallery": "/api/recipient-list"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/recipient-list",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/recipient-list-native"),
  },
  "request-reply": {
    title: "Request-Reply",
    workflowId: "request-reply/workflows/request-reply.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/request-reply",
        "gallery": "/api/request-reply"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/request-reply",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/request-reply-native"),
  },
  "resequencer": {
    title: "Resequencer",
    workflowId: "resequencer/workflows/resequencer.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/resequencer",
        "gallery": "/api/resequencer"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/resequencer/event": "/api/resequencer/event",
        "/api/run/[runId]": "/api/resequencer/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/resequencer",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/resequencer/event",
        "kind": "extra"
      },
      {
        "route": "/api/resequencer/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/resequencer-native"),
  },
  "retry-backoff": {
    title: "Retry-Backoff",
    workflowId: "retry-backoff/workflows/retry-backoff.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/retry-backoff",
        "gallery": "/api/retry-backoff"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/retry-backoff",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/retry-backoff-native"),
  },
  "retryable-rate-limit": {
    title: "Retryable-Rate-Limit",
    workflowId: "retryable-rate-limit/workflows/retryable-rate-limit.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_start_route:/api/start->/api/retryable-rate-limit"],
    routeMap: {
      "start": {
        "original": "/api/start",
        "gallery": "/api/retryable-rate-limit"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/start": "/api/retryable-rate-limit/start"
      }
    },
    apiRoutes: [
      {
        "route": "/api/retryable-rate-limit",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/retryable-rate-limit/start",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/retryable-rate-limit-native"),
  },
  "routing-slip": {
    title: "Routing-Slip",
    workflowId: "routing-slip/workflows/routing-slip.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/routing-slip",
        "gallery": "/api/routing-slip"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/routing-slip",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/routing-slip-native"),
  },
  "saga": {
    title: "Saga",
    workflowId: "saga/workflows/subscription-upgrade-saga.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/saga",
        "gallery": "/api/saga"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/saga",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/saga-native"),
  },
  "scatter-gather": {
    title: "Scatter-Gather",
    workflowId: "scatter-gather/workflows/scatter-gather.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/scatter-gather",
        "gallery": "/api/scatter-gather"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/scatter-gather",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/scatter-gather-native"),
  },
  "scheduled-digest": {
    title: "Scheduled-Digest",
    workflowId: "scheduled-digest/workflows/scheduled-digest.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/event->/api/scheduled-digest/event"],
    routeMap: {
      "start": {
        "original": "/api/scheduled-digest",
        "gallery": "/api/scheduled-digest"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/event": "/api/scheduled-digest/event"
      }
    },
    apiRoutes: [
      {
        "route": "/api/scheduled-digest",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/scheduled-digest/event",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/scheduled-digest-native"),
  },
  "scheduler-agent-supervisor": {
    title: "Scheduler-Agent-Supervisor",
    workflowId: "scheduler-agent-supervisor/workflows/scheduler-agent-supervisor.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/scheduler-agent-supervisor",
        "gallery": "/api/scheduler-agent-supervisor"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/scheduler-agent-supervisor",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/scheduler-agent-supervisor-native"),
  },
  "splitter": {
    title: "Splitter",
    workflowId: "splitter/workflows/order-splitter.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/splitter",
        "gallery": "/api/splitter"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/splitter",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/splitter-native"),
  },
  "status-poller": {
    title: "Status-Poller",
    workflowId: "status-poller/workflows/status-poller.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/status-poller",
        "gallery": "/api/status-poller"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/status-poller",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/status-poller-native"),
  },
  "throttle": {
    title: "Throttle",
    workflowId: "throttle/workflows/throttle.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/throttle",
        "gallery": "/api/throttle"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/throttle",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/throttle-native"),
  },
  "transactional-outbox": {
    title: "Transactional-Outbox",
    workflowId: "transactional-outbox/workflows/transactional-outbox.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/transactional-outbox",
        "gallery": "/api/transactional-outbox"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/run/[runId]": "/api/transactional-outbox/run/[runId]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/transactional-outbox",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/transactional-outbox/run/[runId]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/transactional-outbox-native"),
  },
  "wakeable-reminder": {
    title: "Wakeable-Reminder",
    workflowId: "wakeable-reminder/workflows/wakeable-reminder.ts",
    uiStatus: "native-ready",
    uiReasons: ["hardcoded_extra_route:/api/wake->/api/wakeable-reminder/wake"],
    routeMap: {
      "start": {
        "original": "/api/wakeable-reminder",
        "gallery": "/api/wakeable-reminder"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/wake": "/api/wakeable-reminder/wake"
      }
    },
    apiRoutes: [
      {
        "route": "/api/wakeable-reminder",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/wakeable-reminder/wake",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/wakeable-reminder-native"),
  },
  "webhook-basics": {
    title: "Webhook-Basics",
    workflowId: "webhook-basics/workflows/payment-webhook.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/webhook-basics",
        "gallery": "/api/webhook-basics"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {
        "/api/webhook/[token]": "/api/webhook-basics/webhook/[token]"
      }
    },
    apiRoutes: [
      {
        "route": "/api/webhook-basics",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      },
      {
        "route": "/api/webhook-basics/webhook/[token]",
        "kind": "extra"
      }
    ],
    component: () => import("@/app/components/demos/webhook-basics-native"),
  },
  "wire-tap": {
    title: "Wire-Tap",
    workflowId: "wire-tap/workflows/wire-tap.ts",
    uiStatus: "native-ready",
    uiReasons: [],
    routeMap: {
      "start": {
        "original": "/api/wire-tap",
        "gallery": "/api/wire-tap"
      },
      "readable": {
        "original": "/api/readable/[runId]",
        "gallery": "/api/readable/[runId]"
      },
      "extras": {}
    },
    apiRoutes: [
      {
        "route": "/api/wire-tap",
        "kind": "start"
      },
      {
        "route": "/api/readable/[runId]",
        "kind": "readable"
      }
    ],
    component: () => import("@/app/components/demos/wire-tap-native"),
  }
};
