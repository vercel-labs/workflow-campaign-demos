import { start } from "workflow/api";
import {
  eventSourcing,
  type CommandType,
} from "@/event-sourcing/workflows/event-sourcing";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  aggregateId?: unknown;
  commands?: unknown;
};

const VALID_COMMANDS = new Set<CommandType>([
  "CreateOrder",
  "AuthorizePayment",
  "ReserveInventory",
  "ShipOrder",
  "CancelOrder",
]);

function parseCommands(value: unknown): CommandType[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const commands = value.filter(
    (item): item is CommandType =>
      typeof item === "string" && VALID_COMMANDS.has(item as CommandType),
  );

  return commands.length === value.length ? commands : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/event-sourcing",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const aggregateId =
    typeof body.aggregateId === "string" ? body.aggregateId.trim() : "";
  const commands = parseCommands(body.commands);

  if (!aggregateId) {
    return jsonError(400, "INVALID_REQUEST", "aggregateId is required");
  }

  if (!commands || commands.length === 0) {
    return jsonError(400, "INVALID_REQUEST", "commands must be a non-empty command array");
  }

  try {
    const run = await start(eventSourcing, [aggregateId, commands]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/event-sourcing",
        action: "workflow_started",
        runId: run.runId,
        aggregateId,
        commandCount: commands.length,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        aggregateId,
        commands,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/event-sourcing",
        action: "start_failed",
        aggregateId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { aggregateId });
  }
}
