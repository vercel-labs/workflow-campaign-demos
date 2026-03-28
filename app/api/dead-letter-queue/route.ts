// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { deadLetterQueue } from "@/dead-letter-queue/workflows/dead-letter-queue";

type DLQRequestBody = {
  messages?: unknown;
  poisonMessages?: unknown;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  let body: DLQRequestBody;

  try {
    body = (await request.json()) as DLQRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = parseStringArray(body.messages);
  const poisonMessages = parseStringArray(body.poisonMessages);

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required and must not be empty" },
      { status: 400 }
    );
  }

  const run = await start(deadLetterQueue, [messages, poisonMessages]);

  return NextResponse.json({
    runId: run.runId,
    messages,
    poisonMessages,
    status: "processing",
  });
}
