import { start } from "workflow/api";
import { runOnboardingDrip } from "@/onboarding-drip/workflows/onboarding-drip";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/onboarding-drip",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!email) {
    return jsonError(400, "INVALID_REQUEST", "email is required");
  }

  try {
    const run = await start(runOnboardingDrip, [email]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/onboarding-drip",
        action: "workflow_started",
        runId: run.runId,
        email,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, email },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/onboarding-drip",
        action: "start_failed",
        error: message,
        email,
      }),
    );
    return jsonError(500, "START_FAILED", message, { email });
  }
}
