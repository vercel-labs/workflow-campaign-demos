// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

// ── Types ───────────────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical";
export type Route = "self-service" | "tier-1" | "tier-2" | "escalation";

export type HistoryEntry = {
  step: string;
  status: "started" | "succeeded" | "failed" | "decision";
  message: string;
  timestamp: string;
  attempt?: number;
  detail?: Record<string, unknown>;
};

export type ApiError = {
  code: string;
  message: string;
  step: string;
  history: HistoryEntry[];
};

export type TicketEnvelope = {
  correlationId: string;
  subject: string;
  body: string;
  severity: Severity | null;
  route: Route | null;
  dispatchedTo: string | null;
  history: HistoryEntry[];
  status: "processing" | "completed" | "failed";
};

export type HistoryEvent =
  | { type: "step_started"; step: string; message: string }
  | { type: "step_succeeded"; step: string; message: string }
  | { type: "step_failed"; step: string; message: string; error: string }
  | { type: "decision"; step: string; message: string; detail: Record<string, unknown> }
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

export async function supportTicketRouting(
  correlationId: string,
  subject: string,
  body: string,
  failAtStep: string | null = null
): Promise<TicketEnvelope> {
  "use workflow";

  let envelope: TicketEnvelope = {
    correlationId,
    subject,
    body,
    severity: null,
    route: null,
    dispatchedTo: null,
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
    envelope = await finalizeFailure(
      envelope,
      err instanceof Error ? err.message : "Unknown error"
    );
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
      message: `Creating envelope for ticket ${envelope.correlationId}`,
    });

    const result = appendHistory(envelope, {
      step: "createEnvelope",
      status: "succeeded",
      message: `Envelope created with correlationId ${envelope.correlationId}`,
    });

    await writer.write({
      type: "step_succeeded",
      step: "createEnvelope",
      message: `Envelope created with correlationId ${envelope.correlationId}`,
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
      const failed = appendHistory(envelope, {
        step: "normalizeTicket",
        status: "failed",
        message: "Normalization service unavailable",
      });
      await writer.write({
        type: "step_failed",
        step: "normalizeTicket",
        message: "Normalization service unavailable",
        error: "SERVICE_UNAVAILABLE",
      });
      throw new Error("Normalization service unavailable");
    }

    const normalizedSubject = envelope.subject.trim().toLowerCase();
    const normalizedBody = envelope.body.trim().toLowerCase();

    const result = appendHistory(
      { ...envelope, subject: normalizedSubject, body: normalizedBody },
      {
        step: "normalizeTicket",
        status: "succeeded",
        message: `Normalized: "${normalizedSubject}"`,
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
      appendHistory(envelope, {
        step: "classifySeverity",
        status: "failed",
        message: "Classification model timeout",
      });
      await writer.write({
        type: "step_failed",
        step: "classifySeverity",
        message: "Classification model timeout",
        error: "MODEL_TIMEOUT",
      });
      throw new Error("Classification model timeout");
    }

    const combined = `${envelope.subject} ${envelope.body}`;
    let severity: Severity = "low";
    for (const [keyword, level] of Object.entries(SEVERITY_KEYWORDS)) {
      if (combined.includes(keyword)) {
        severity = level;
        break;
      }
    }

    const result = appendHistory(
      { ...envelope, severity },
      {
        step: "classifySeverity",
        status: "decision",
        message: `Classified as ${severity}`,
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
      appendHistory(envelope, {
        step: "chooseRoute",
        status: "failed",
        message: "Routing table unavailable",
      });
      await writer.write({
        type: "step_failed",
        step: "chooseRoute",
        message: "Routing table unavailable",
        error: "ROUTING_UNAVAILABLE",
      });
      throw new Error("Routing table unavailable");
    }

    const route = ROUTE_MAP[envelope.severity ?? "low"];

    const result = appendHistory(
      { ...envelope, route },
      {
        step: "chooseRoute",
        status: "decision",
        message: `Routed to ${route}`,
        detail: { route, basedOnSeverity: envelope.severity },
      }
    );

    await writer.write({
      type: "decision",
      step: "chooseRoute",
      message: `Routed to ${route}`,
      detail: { route, basedOnSeverity: envelope.severity },
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
    const target = DISPATCH_TARGETS[envelope.route ?? "self-service"];

    await writer.write({
      type: "step_started",
      step: "dispatchTicket",
      message: `Dispatching to ${target}`,
    });

    await delay(DISPATCH_DELAY_MS);

    if (failAtStep === "dispatchTicket") {
      appendHistory(envelope, {
        step: "dispatchTicket",
        status: "failed",
        message: `Failed to dispatch to ${target}`,
      });
      await writer.write({
        type: "step_failed",
        step: "dispatchTicket",
        message: `Failed to dispatch to ${target}`,
        error: "DISPATCH_FAILED",
      });
      throw new Error(`Failed to dispatch to ${target}`);
    }

    const result = appendHistory(
      { ...envelope, dispatchedTo: target },
      {
        step: "dispatchTicket",
        status: "succeeded",
        message: `Dispatched to ${target}`,
        detail: { target, route: envelope.route },
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
        status: "succeeded",
        message: `Ticket ${envelope.correlationId} processing complete`,
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
  errorMessage: string
): Promise<TicketEnvelope> {
  "use step";
  const writer = getWritable<HistoryEvent>().getWriter();

  try {
    await delay(FINALIZE_DELAY_MS);

    const result = appendHistory(
      { ...envelope, status: "failed" as const },
      {
        step: "finalizeFailure",
        status: "failed",
        message: errorMessage,
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
