import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { guaranteedDelivery } from "@/workflows/guaranteed-delivery";

type GDRequestBody = {
  messages?: unknown;
  failMessages?: unknown;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  let body: GDRequestBody;

  try {
    body = (await request.json()) as GDRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = parseStringArray(body.messages);
  const failMessages = parseStringArray(body.failMessages);

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required and must not be empty" },
      { status: 400 }
    );
  }

  const run = await start(guaranteedDelivery, [messages, failMessages]);

  return NextResponse.json({
    runId: run.runId,
    messages,
    failMessages,
    status: "processing",
  });
}
