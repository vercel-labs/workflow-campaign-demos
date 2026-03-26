import { start } from "workflow/api";
import { generateReport } from "@/cancellable-export/workflows/report-generator";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/cancellable-export",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const accountId = body.accountId;
  if (!accountId || typeof accountId !== "string") {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/cancellable-export",
        action: "missing_account_id",
      }),
    );

    return jsonError(400, "MISSING_ACCOUNT_ID", "accountId is required");
  }

  const systemPrompt =
    typeof body.systemPrompt === "string" ? body.systemPrompt : "";

  try {
    const run = await start(generateReport, [accountId, systemPrompt]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/cancellable-export",
        action: "workflow_started",
        runId: run.runId,
        accountId,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, accountId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/cancellable-export",
        action: "start_failed",
        accountId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { accountId });
  }
}
