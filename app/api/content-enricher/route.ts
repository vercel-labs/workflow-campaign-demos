import { start } from "workflow/api";
import { enrichLeadProfile } from "@/content-enricher/workflows/content-enricher";

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/content-enricher", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/content-enricher",
        action: "invalid_email",
        email,
      }),
    );
    return createError(400, "email must be a valid address", "INVALID_REQUEST");
  }

  try {
    const run = await start(enrichLeadProfile, [email]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/content-enricher",
        action: "workflow_started",
        runId: run.runId,
        email,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, email, status: "enriching" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/content-enricher",
        action: "start_failed",
        email,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
