// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  messageTranslatorFlow,
  type SourceFormat,
} from "@/message-translator/workflows/message-translator";

type RequestBody = {
  messageId?: unknown;
  sourceFormat?: unknown;
};

const VALID_FORMATS = new Set<SourceFormat>(["xml", "csv", "legacy-json"]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messageId =
    typeof body.messageId === "string" ? body.messageId.trim() : "";
  const sourceFormat =
    typeof body.sourceFormat === "string" && VALID_FORMATS.has(body.sourceFormat as SourceFormat)
      ? (body.sourceFormat as SourceFormat)
      : "xml";

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const run = await start(messageTranslatorFlow, [messageId, sourceFormat]);

  return NextResponse.json({
    runId: run.runId,
    messageId,
    sourceFormat,
    status: "translating",
  });
}
