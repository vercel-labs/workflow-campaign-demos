// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { digestEvent } from "@/scheduled-digest/workflows/scheduled-digest";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token;
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const type = body.type;
  if (typeof type !== "string" || !type.trim()) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const message = body.message;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    await digestEvent.resume(token.trim(), {
      type: type.trim(),
      message: message.trim(),
    });

    return NextResponse.json({ ok: true, token: token.trim() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
