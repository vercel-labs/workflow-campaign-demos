/**
 * Workflow DevKit API primitives taxonomy.
 *
 * Maps every demo to the DevKit APIs it uses, enabling
 * API-first browsing, combination filtering, and visual fingerprints.
 */

export type WorkflowApi = {
  id: string;
  label: string;
  kind: "directive" | "stream" | "flow-control" | "error" | "metadata";
  description: string;
  color: string; // tailwind color token (without prefix)
};

export const workflowApis: WorkflowApi[] = [
  {
    id: "use-workflow",
    label: "use workflow",
    kind: "directive",
    description: "Marks a function as a durable workflow entry point",
    color: "blue",
  },
  {
    id: "use-step",
    label: "use step",
    kind: "directive",
    description: "Marks a function as the smallest resumable unit of work",
    color: "blue",
  },
  {
    id: "getWritable",
    label: "getWritable",
    kind: "stream",
    description: "Stream typed events from workflow steps to the client via SSE",
    color: "cyan",
  },
  {
    id: "sleep",
    label: "sleep",
    kind: "flow-control",
    description: "Pause execution for a duration — survives restarts",
    color: "violet",
  },
  {
    id: "defineHook",
    label: "defineHook",
    kind: "flow-control",
    description: "Create a hook that pauses until an external signal arrives",
    color: "amber",
  },
  {
    id: "FatalError",
    label: "FatalError",
    kind: "error",
    description: "Stop retries — this error is permanent and non-recoverable",
    color: "red",
  },
  {
    id: "RetryableError",
    label: "RetryableError",
    kind: "error",
    description: "Signal a retriable failure with optional backoff hint",
    color: "amber",
  },
  {
    id: "getStepMetadata",
    label: "getStepMetadata",
    kind: "metadata",
    description: "Access current step attempt count, step ID, and retry info",
    color: "green",
  },
  {
    id: "getWorkflowMetadata",
    label: "getWorkflowMetadata",
    kind: "metadata",
    description: "Access the current workflow run ID and execution context",
    color: "green",
  },
];

export const workflowApiMap = new Map(workflowApis.map((a) => [a.id, a]));

/** Which non-universal APIs each demo uses. (Every demo uses use-workflow, use-step, getWritable.) */
export const demoApis: Record<string, string[]> = {
  aggregator: ["sleep", "defineHook", "getWritable"],
  "approval-chain": ["sleep", "defineHook", "getWritable"],
  "approval-gate": ["sleep", "defineHook", "getWritable"],
  "async-request-reply": ["sleep", "FatalError", "getWritable"],
  "batch-processor": ["getWritable"],
  bulkhead: ["sleep", "getWritable"],
  "cancellable-export": ["getWritable"],
  choreography: ["sleep", "FatalError", "getStepMetadata", "getWritable"],
  "circuit-breaker": ["sleep", "getWritable"],
  "claim-check": ["defineHook", "getWritable"],
  "competing-consumers": ["getStepMetadata", "getWritable"],
  "content-based-router": ["sleep", "getWritable"],
  "content-enricher": ["getWritable"],
  "correlation-identifier": ["sleep", "getWritable"],
  "dead-letter-queue": ["getStepMetadata", "getWritable"],
  detour: ["getWritable"],
  "event-gateway": ["sleep", "defineHook", "getWritable"],
  "event-sourcing": ["getWritable"],
  "fan-out": ["FatalError", "getStepMetadata", "getWritable"],
  "guaranteed-delivery": ["getStepMetadata", "getWritable"],
  "hedge-request": ["getStepMetadata", "getWritable"],
  "idempotent-receiver": ["getWritable"],
  "map-reduce": ["getStepMetadata", "getWritable"],
  "message-filter": ["FatalError", "getWritable"],
  "message-history": ["getWritable"],
  "message-translator": ["getWritable"],
  "namespaced-streams": ["getWorkflowMetadata", "getWritable"],
  normalizer: ["FatalError", "getWritable"],
  "onboarding-drip": ["sleep", "getWritable"],
  pipeline: ["getWritable"],
  "priority-queue": ["getWritable"],
  "process-manager": ["sleep", "getStepMetadata", "getWritable"],
  "publish-subscribe": ["getWritable"],
  "recipient-list": ["FatalError", "getStepMetadata", "getWritable"],
  "request-reply": ["getWritable"],
  resequencer: ["defineHook", "FatalError", "getWritable"],
  "retry-backoff": ["sleep", "FatalError", "getWritable"],
  "retryable-rate-limit": ["RetryableError", "getStepMetadata", "getWritable"],
  "routing-slip": ["getWritable"],
  saga: ["FatalError", "getWritable"],
  "scatter-gather": ["getWritable"],
  "scheduled-digest": ["sleep", "defineHook", "getWritable"],
  "scheduler-agent-supervisor": ["sleep", "getWritable"],
  splitter: ["FatalError", "getStepMetadata", "getWritable"],
  "status-poller": ["sleep", "getWritable"],
  throttle: ["getWritable"],
  "transactional-outbox": ["getWritable"],
  "wakeable-reminder": ["sleep", "defineHook", "getWritable"],
  "webhook-basics": ["getWritable"],
  "wire-tap": ["FatalError", "getWritable"],
};

/** Get the interesting (non-universal) APIs for a demo. */
export function getDemoApis(slug: string): WorkflowApi[] {
  const ids = demoApis[slug] ?? [];
  // Filter out getWritable since every demo has it — show only the distinguishing APIs
  const interesting = ids.filter((id) => id !== "getWritable");
  return interesting
    .map((id) => workflowApiMap.get(id))
    .filter((a): a is WorkflowApi => a != null);
}

/** Get ALL APIs for a demo including the universal ones. */
export function getAllDemoApis(slug: string): WorkflowApi[] {
  const ids = demoApis[slug] ?? [];
  const all = ["use-workflow", "use-step", ...ids];
  return all
    .map((id) => workflowApiMap.get(id))
    .filter((a): a is WorkflowApi => a != null);
}

/** Get the API kind color class for badges. */
export function getApiColorClasses(api: WorkflowApi): {
  badge: string;
  dot: string;
} {
  const map: Record<string, { badge: string; dot: string }> = {
    blue: {
      badge: "border-blue-700/40 bg-blue-700/10 text-blue-700",
      dot: "bg-blue-700",
    },
    cyan: {
      badge: "border-cyan-700/40 bg-cyan-700/10 text-cyan-700",
      dot: "bg-cyan-700",
    },
    violet: {
      badge: "border-violet-700/40 bg-violet-700/10 text-violet-700",
      dot: "bg-violet-700",
    },
    amber: {
      badge: "border-amber-700/40 bg-amber-700/10 text-amber-700",
      dot: "bg-amber-700",
    },
    red: {
      badge: "border-red-700/40 bg-red-700/10 text-red-700",
      dot: "bg-red-700",
    },
    green: {
      badge: "border-green-700/40 bg-green-700/10 text-green-700",
      dot: "bg-green-700",
    },
  };
  return map[api.color] ?? map.blue;
}

/** Count how many demos use each API. */
export function getApiUsageCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const api of workflowApis) {
    counts.set(api.id, 0);
  }
  // Every demo uses the universal trio
  const demoCount = Object.keys(demoApis).length;
  counts.set("use-workflow", demoCount);
  counts.set("use-step", demoCount);
  counts.set("getWritable", demoCount);

  for (const apis of Object.values(demoApis)) {
    for (const id of apis) {
      if (id !== "getWritable") {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  return counts;
}
