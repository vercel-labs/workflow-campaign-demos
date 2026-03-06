import { start } from "workflow/api";
import { runOnboardingDrip } from "@/workflows/onboarding-drip";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function createErrorResponse(status: number, code: string, message: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(400, "INVALID_JSON", "Invalid JSON body");
  }

  const email = body?.email;

  if (!email || typeof email !== "string") {
    return createErrorResponse(400, "MISSING_EMAIL", "Email is required");
  }

  let run: Awaited<ReturnType<typeof start>>;
  try {
    // Start the onboarding drip workflow
    // This executes asynchronously and doesn't block the request
    run = await start(runOnboardingDrip, [email]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start workflow";
    return createErrorResponse(500, "START_FAILED", message);
  }

  return Response.json({
    ok: true,
    message: "Onboarding drip campaign started",
    runId: run.runId,
    email,
    schedule: {
      day0: "Welcome email (immediate)",
      day1: "Getting started tips",
      day3: "Feature highlights",
      day7: "Follow-up and feedback request",
    },
  });
}
