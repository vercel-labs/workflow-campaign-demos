import { getWritable, sleep } from "workflow";

export type TicketType = "billing" | "technical" | "account" | "feedback";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type RouterEvent =
  | { type: "ticket_received"; ticketId: string; subject: string }
  | { type: "classifying"; ticketId: string }
  | { type: "classified"; ticketId: string; ticketType: TicketType; confidence: number }
  | { type: "routing"; ticketId: string; destination: TicketType }
  | { type: "handler_processing"; ticketId: string; destination: TicketType; step: string }
  | { type: "handler_complete"; ticketId: string; destination: TicketType; resolution: string }
  | { type: "done"; ticketId: string; routedTo: TicketType; totalSteps: number };

export interface ContentBasedRouterResult {
  ticketId: string;
  routedTo: TicketType;
  totalSteps: number;
}

// Simulated classification keywords per ticket type
const CLASSIFICATION_RULES: Record<TicketType, string[]> = {
  billing: ["invoice", "charge", "payment", "refund", "subscription", "billing", "price"],
  technical: ["error", "bug", "crash", "timeout", "api", "deploy", "technical", "broken"],
  account: ["password", "login", "access", "permissions", "account", "profile", "settings"],
  feedback: ["feature", "suggestion", "improvement", "feedback", "request", "wishlist"],
};

// Demo timing
const CLASSIFY_DELAY_MS = 800;
const ROUTE_DELAY_MS = 400;
const HANDLER_STEP_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyContent(subject: string): { ticketType: TicketType; confidence: number } {
  const lower = subject.toLowerCase();
  let bestType: TicketType = "feedback";
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(CLASSIFICATION_RULES) as [TicketType, string[]][]) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.99, 0.7 + bestScore * 0.1) : 0.5;
  return { ticketType: bestType, confidence };
}

export async function contentBasedRouterFlow(
  ticketId: string,
  subject: string,
  priority: TicketPriority = "medium"
): Promise<ContentBasedRouterResult> {
  "use workflow";

  // Step 1: Receive ticket
  await emitEvent({ type: "ticket_received", ticketId, subject });

  // Step 2: Classify ticket content
  const { ticketType, confidence } = await classifyTicket(ticketId, subject);

  // Step 3: Route to appropriate handler
  await emitEvent({ type: "routing", ticketId, destination: ticketType });
  await sleep(`${ROUTE_DELAY_MS}ms`);

  // Step 4: Branch to specialized handler based on classification
  let totalSteps: number;
  if (ticketType === "billing") {
    totalSteps = await handleBilling(ticketId, subject, priority);
  } else if (ticketType === "technical") {
    totalSteps = await handleTechnical(ticketId, subject, priority);
  } else if (ticketType === "account") {
    totalSteps = await handleAccount(ticketId, subject, priority);
  } else {
    totalSteps = await handleFeedback(ticketId, subject, priority);
  }

  // Step 5: Emit completion
  await emitEvent({ type: "done", ticketId, routedTo: ticketType, totalSteps });

  return { ticketId, routedTo: ticketType, totalSteps };
}

async function classifyTicket(
  ticketId: string,
  subject: string
): Promise<{ ticketType: TicketType; confidence: number }> {
  "use step";

  const writer = getWritable<RouterEvent>().getWriter();
  try {
    await writer.write({ type: "classifying", ticketId });
    await delay(CLASSIFY_DELAY_MS);

    const result = classifyContent(subject);
    await writer.write({
      type: "classified",
      ticketId,
      ticketType: result.ticketType,
      confidence: result.confidence,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function handleBilling(
  ticketId: string,
  _subject: string,
  _priority: TicketPriority
): Promise<number> {
  "use step";

  const writer = getWritable<RouterEvent>().getWriter();
  const steps = ["Verify account billing status", "Check payment history", "Generate resolution"];
  try {
    for (const step of steps) {
      await writer.write({ type: "handler_processing", ticketId, destination: "billing", step });
      await delay(HANDLER_STEP_DELAY_MS);
    }
    await writer.write({
      type: "handler_complete",
      ticketId,
      destination: "billing",
      resolution: "Billing inquiry resolved — invoice adjustment applied",
    });
    return steps.length;
  } finally {
    writer.releaseLock();
  }
}

async function handleTechnical(
  ticketId: string,
  _subject: string,
  _priority: TicketPriority
): Promise<number> {
  "use step";

  const writer = getWritable<RouterEvent>().getWriter();
  const steps = ["Reproduce issue", "Analyze stack trace", "Apply fix", "Verify resolution"];
  try {
    for (const step of steps) {
      await writer.write({ type: "handler_processing", ticketId, destination: "technical", step });
      await delay(HANDLER_STEP_DELAY_MS);
    }
    await writer.write({
      type: "handler_complete",
      ticketId,
      destination: "technical",
      resolution: "Technical issue resolved — patch deployed to staging",
    });
    return steps.length;
  } finally {
    writer.releaseLock();
  }
}

async function handleAccount(
  ticketId: string,
  _subject: string,
  _priority: TicketPriority
): Promise<number> {
  "use step";

  const writer = getWritable<RouterEvent>().getWriter();
  const steps = ["Verify identity", "Update account settings", "Confirm changes"];
  try {
    for (const step of steps) {
      await writer.write({ type: "handler_processing", ticketId, destination: "account", step });
      await delay(HANDLER_STEP_DELAY_MS);
    }
    await writer.write({
      type: "handler_complete",
      ticketId,
      destination: "account",
      resolution: "Account issue resolved — access restored",
    });
    return steps.length;
  } finally {
    writer.releaseLock();
  }
}

async function handleFeedback(
  ticketId: string,
  _subject: string,
  _priority: TicketPriority
): Promise<number> {
  "use step";

  const writer = getWritable<RouterEvent>().getWriter();
  const steps = ["Log feedback", "Categorize suggestion", "Notify product team"];
  try {
    for (const step of steps) {
      await writer.write({ type: "handler_processing", ticketId, destination: "feedback", step });
      await delay(HANDLER_STEP_DELAY_MS);
    }
    await writer.write({
      type: "handler_complete",
      ticketId,
      destination: "feedback",
      resolution: "Feedback logged — added to product backlog",
    });
    return steps.length;
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: RouterEvent): Promise<void> {
  "use step";
  const writer = getWritable<RouterEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
