// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  contentBasedRouterFlow,
  type TicketPriority,
} from "@/content-based-router/workflows/content-based-router";

type RequestBody = {
  ticketId?: unknown;
  subject?: unknown;
  priority?: unknown;
};

const VALID_PRIORITIES = new Set<TicketPriority>(["low", "medium", "high", "urgent"]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketId =
    typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  const priority =
    typeof body.priority === "string" && VALID_PRIORITIES.has(body.priority as TicketPriority)
      ? (body.priority as TicketPriority)
      : "medium";

  if (!ticketId) {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  const run = await start(contentBasedRouterFlow, [ticketId, subject, priority]);

  return NextResponse.json({
    runId: run.runId,
    ticketId,
    subject,
    priority,
    status: "routing",
  });
}
