// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { eventSourcing, type CommandType } from "@/event-sourcing/workflows/event-sourcing";

type ESRequestBody = {
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

function parseCommands(value: unknown): CommandType[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (cmd): cmd is CommandType =>
      typeof cmd === "string" && VALID_COMMANDS.has(cmd as CommandType)
  );
}

export async function POST(request: Request) {
  let body: ESRequestBody;

  try {
    body = (await request.json()) as ESRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const aggregateId =
    typeof body.aggregateId === "string" ? body.aggregateId.trim() : "";
  const commands = parseCommands(body.commands);

  if (!aggregateId) {
    return NextResponse.json(
      { error: "aggregateId is required" },
      { status: 400 }
    );
  }

  if (commands.length === 0) {
    return NextResponse.json(
      { error: "commands array is required and must not be empty" },
      { status: 400 }
    );
  }

  const run = await start(eventSourcing, [aggregateId, commands]);

  return NextResponse.json({
    runId: run.runId,
    aggregateId,
    commands,
    status: "processing",
  });
}
