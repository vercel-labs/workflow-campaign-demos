import { NextResponse } from "next/server";
import { reminderActionHook } from "@/workflows/wakeable-reminder";
import type { ReminderAction } from "@/workflows/wakeable-reminder";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const action = body.action as ReminderAction | undefined;
  if (!action || typeof action !== "object" || !action.type) {
    return NextResponse.json({ error: "action is required with a type field" }, { status: 400 });
  }

  try {
    const result = await reminderActionHook.resume(token, action);

    if (!result) {
      return NextResponse.json(
        { ok: false, error: { code: "HOOK_NOT_FOUND", message: "Hook not found or already resolved" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Action ${action.type} delivered`,
      runId: result.runId,
      token,
      action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
