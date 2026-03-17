// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

// ── Types ───────────────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical";
export type Route = "self-service" | "tier-1" | "tier-2" | "escalation";

export type HistoryEntry = {
  step: string;
  action: "started" | "succeeded" | "failed" | "decision";
  timestamp: string;
  attempt: number;
  correlationId: string;
  detail?: Record<string, unknown>;
  error?: ApiError;
};

export type ApiError = {
  code: string;
  message: string;
};

export type TicketEnvelope = {
  payload: {
    correlationId: string;
    subject: string;
    body: string;
    severity: Severity | null;
    route: Route | null;
    dispatchedTo: string | null;
  };
  history: HistoryEntry[];
  status: "processing" | "completed" | "failed";
};

export type HistoryEvent =
  | { type: "step_started"; step: string; message: string }
  | { type: "step_succeeded"; step: string; message: string }
  | {
      type: "step_failed";
      step: string;
      message: string;
      error: ApiError;
    }
  | {
      type: "decision";
      step: string;
      message: string;
      detail: Record<string, unknown>;
    }
  | { type: "done"; envelope: TicketEnvelope };

// ── Helpers ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendHistory(
  envelope: TicketEnvelope,
  entry: Omit<HistoryEntry, "timestamp">
): TicketEnvelope {
  return {
    ...envelope,
    history: [
      ...envelope.history,
      { ...entry, timestamp: new Date().toISOString() },
    ],
  };
}

// ── Demo configuration ──────────────────────────────────────────────────

const NORMALIZE_DELAY_MS = 400;
const CLASSIFY_DELAY_MS = 600;
const ROUTE_DELAY_MS = 300;
const DISPATCH_DELAY_MS = 700;
const FINALIZE_DELAY_MS = 200;

const SEVERITY_KEYWORDS: Record<string, Severity> = {
  crash: "critical",
  down: "critical",
  outage: "critical",
  urgent: "high",
  broken: "high",
  error: "medium",
  bug: "medium",
  slow: "low",
  question: "low",
};

const ROUTE_MAP: Record<Severity, Route> = {
  low: "self-service",
  medium: "tier-1",
  high: "tier-2",
  critical: "escalation",
};

const DISPATCH_TARGETS: Record<Route, string> = {
  "self-service": "Knowledge Base Bot",
  "tier-1": "Support Agent Pool",
  "tier-2": "Senior Engineer On-Call",
  escalation: "Incident Commander",
};

// ── Workflow ─────────────────────────────────────────────────────────────

export async function messageHistory(
  correlationId: string,
  subject: string,
  body: string,
  failAtStep: string | null = null
): Promise<TicketEnvelope> {
  "use workflow";

  let envelope: TicketEnvelope = {
    payload: {
      correlationId,
      subject,
      body,
      severity: null,
      route: null,
      dispatchedTo: null,
    },
    history: [],
    status: "processing",
  };

  try {
    envelope = await createEnvelope(envelope);
    envelope = await normalizeTicket(envelope, failAtStep);
    envelope = await classifySeverity(envelope, failAtStep);
    envelope = await chooseRoute(envelope, failAtStep);
    envelope = await dispatchTicket(envelope, failAtStep);
    envelope = await finalizeSuccess(envelope);
  } catch (err) {
    const apiError: ApiError =
      err instanceof Error
        ? { code: "WORKFLOW_FAILED", message: err.message }
        : { code: "UNKNOWN", message: "Unknown error" };
    envelope = await finalizeFailure(envelope, apiError);
  }

  return envelope;
}

// ── Steps ────────────────────────────────────────────────────────────────

async function createEnvelope(
  envelope: TicketEnvelope
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "createEnvelope",
      message: `Creating envelope for ticket ${envelope.payload.correlationId}`,
    });

    const result = appendHistory(envelope, {
      step: "createEnvelope",
      action: "succeeded",
      attempt: 1,
      correlationId: envelope.payload.correlationId,
      detail: { correlationId: envelope.payload.correlationId },
    });

    await writer.write({
      type: "step_succeeded",
      step: "createEnvelope",
      message: `Envelope created with correlationId ${envelope.payload.correlationId}`,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function normalizeTicket(
  envelope: TicketEnvelope,
  failAtStep: string | null
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "normalizeTicket",
      message: "Normalizing ticket text",
    });

    await delay(NORMALIZE_DELAY_MS);

    if (failAtStep === "normalizeTicket") {
      const apiError: ApiError = {
        code: "SERVICE_UNAVAILABLE",
        message: "Normalization service unavailable",
      };
      const failed = appendHistory(envelope, {
        step: "normalizeTicket",
        action: "failed",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        error: apiError,
      });
      await writer.write({
        type: "step_failed",
        step: "normalizeTicket",
        message: "Normalization service unavailable",
        error: apiError,
      });
      throw new Error(apiError.message);
    }

    const normalizedSubject = envelope.payload.subject.trim().toLowerCase();
    const normalizedBody = envelope.payload.body.trim().toLowerCase();

    const result = appendHistory(
      {
        ...envelope,
        payload: {
          ...envelope.payload,
          subject: normalizedSubject,
          body: normalizedBody,
        },
      },
      {
        step: "normalizeTicket",
        action: "succeeded",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        detail: { normalizedSubject },
      }
    );

    await writer.write({
      type: "step_succeeded",
      step: "normalizeTicket",
      message: `Normalized: "${normalizedSubject}"`,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function classifySeverity(
  envelope: TicketEnvelope,
  failAtStep: string | null
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "classifySeverity",
      message: "Classifying ticket severity",
    });

    await delay(CLASSIFY_DELAY_MS);

    if (failAtStep === "classifySeverity") {
      const apiError: ApiError = {
        code: "MODEL_TIMEOUT",
        message: "Classification model timeout",
      };
      appendHistory(envelope, {
        step: "classifySeverity",
        action: "failed",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        error: apiError,
      });
      await writer.write({
        type: "step_failed",
        step: "classifySeverity",
        message: "Classification model timeout",
        error: apiError,
      });
      throw new Error(apiError.message);
    }

    const combined = `${envelope.payload.subject} ${envelope.payload.body}`;
    let severity: Severity = "low";
    for (const [keyword, level] of Object.entries(SEVERITY_KEYWORDS)) {
      if (combined.includes(keyword)) {
        severity = level;
        break;
      }
    }

    const result = appendHistory(
      { ...envelope, payload: { ...envelope.payload, severity } },
      {
        step: "classifySeverity",
        action: "decision",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        detail: { severity, matchedText: combined.slice(0, 80) },
      }
    );

    await writer.write({
      type: "decision",
      step: "classifySeverity",
      message: `Classified as ${severity}`,
      detail: { severity },
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function chooseRoute(
  envelope: TicketEnvelope,
  failAtStep: string | null
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "chooseRoute",
      message: "Choosing routing destination",
    });

    await delay(ROUTE_DELAY_MS);

    if (failAtStep === "chooseRoute") {
      const apiError: ApiError = {
        code: "ROUTING_UNAVAILABLE",
        message: "Routing table unavailable",
      };
      appendHistory(envelope, {
        step: "chooseRoute",
        action: "failed",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        error: apiError,
      });
      await writer.write({
        type: "step_failed",
        step: "chooseRoute",
        message: "Routing table unavailable",
        error: apiError,
      });
      throw new Error(apiError.message);
    }

    const route = ROUTE_MAP[envelope.payload.severity ?? "low"];

    const result = appendHistory(
      { ...envelope, payload: { ...envelope.payload, route } },
      {
        step: "chooseRoute",
        action: "decision",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        detail: { route, basedOnSeverity: envelope.payload.severity },
      }
    );

    await writer.write({
      type: "decision",
      step: "chooseRoute",
      message: `Routed to ${route}`,
      detail: { route, basedOnSeverity: envelope.payload.severity },
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function dispatchTicket(
  envelope: TicketEnvelope,
  failAtStep: string | null
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    const target =
      DISPATCH_TARGETS[envelope.payload.route ?? "self-service"];

    await writer.write({
      type: "step_started",
      step: "dispatchTicket",
      message: `Dispatching to ${target}`,
    });

    await delay(DISPATCH_DELAY_MS);

    if (failAtStep === "dispatchTicket") {
      const apiError: ApiError = {
        code: "DISPATCH_FAILED",
        message: `Failed to dispatch to ${target}`,
      };
      appendHistory(envelope, {
        step: "dispatchTicket",
        action: "failed",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        error: apiError,
      });
      await writer.write({
        type: "step_failed",
        step: "dispatchTicket",
        message: `Failed to dispatch to ${target}`,
        error: apiError,
      });
      throw new Error(apiError.message);
    }

    const result = appendHistory(
      { ...envelope, payload: { ...envelope.payload, dispatchedTo: target } },
      {
        step: "dispatchTicket",
        action: "succeeded",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        detail: { target, route: envelope.payload.route },
      }
    );

    await writer.write({
      type: "step_succeeded",
      step: "dispatchTicket",
      message: `Dispatched to ${target}`,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function finalizeSuccess(
  envelope: TicketEnvelope
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await delay(FINALIZE_DELAY_MS);

    const result = appendHistory(
      { ...envelope, status: "completed" as const },
      {
        step: "finalizeSuccess",
        action: "succeeded",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        detail: { totalSteps: envelope.history.length + 1 },
      }
    );

    await writer.write({
      type: "done",
      envelope: result,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function finalizeFailure(
  envelope: TicketEnvelope,
  apiError: ApiError
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await delay(FINALIZE_DELAY_MS);

    const result = appendHistory(
      { ...envelope, status: "failed" as const },
      {
        step: "finalizeFailure",
        action: "failed",
        attempt: 1,
        correlationId: envelope.payload.correlationId,
        error: apiError,
      }
    );

    await writer.write({
      type: "done",
      envelope: result,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}
