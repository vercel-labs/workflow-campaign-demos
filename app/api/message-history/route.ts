// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { supportTicketRouting } from "@/message-history/workflows/support-ticket-routing";

type RequestBody = {
  subject?: unknown;
  body?: unknown;
  failAtStep?: unknown;
};

const VALID_FAIL_STEPS = new Set([
  "normalizeTicket",
  "classifySeverity",
  "chooseRoute",
  "dispatchTicket",
]);

export async function POST(request: Request) {
  let payload: RequestBody;

  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const subject =
    typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body =
    typeof payload.body === "string" ? payload.body.trim() : "";
  const failAtStep =
    typeof payload.failAtStep === "string" && VALID_FAIL_STEPS.has(payload.failAtStep)
      ? payload.failAtStep
      : null;

  if (!subject) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_SUBJECT", message: "subject is required" } },
      { status: 400 }
    );
  }

  if (!body) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_BODY", message: "body is required" } },
      { status: 400 }
    );
  }

  const correlationId = `ticket_${Date.now()}`;

  const run = await start(supportTicketRouting, [
    correlationId,
    subject,
    body,
    failAtStep,
  ]);

  return NextResponse.json({
    runId: run.runId,
    correlationId,
    subject,
    status: "processing",
  });
}
