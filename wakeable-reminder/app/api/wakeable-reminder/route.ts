import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { scheduleReminder } from "@/workflows/wakeable-reminder";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const delayMs = typeof body.delayMs === "number" ? body.delayMs : 0;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (delayMs <= 0) {
    return NextResponse.json({ error: "delayMs must be positive" }, { status: 400 });
  }

  try {
    const run = await start(scheduleReminder, [userId, delayMs]);
    return NextResponse.json({ runId: run.runId, userId, delayMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
