// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { orderSignal, type SignalKind } from "@/event-gateway/workflows/event-gateway";

const VALID_SIGNALS = new Set<SignalKind>(["payment", "inventory", "fraud"]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const signal = typeof body.signal === "string" ? body.signal.trim() : "";

  if (!token) {
    return Response.json(
      { ok: false, error: { code: "MISSING_TOKEN", message: "token is required" } },
      { status: 400 }
    );
  }

  if (!VALID_SIGNALS.has(signal as SignalKind)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_SIGNAL", message: `signal must be one of: ${[...VALID_SIGNALS].join(", ")}` } },
      { status: 400 }
    );
  }

  try {
    const result = await orderSignal.resume(token, { ok: true });

    if (!result) {
      return Response.json(
        { ok: false, error: { code: "HOOK_NOT_FOUND", message: "Hook not found or already resolved" } },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      message: `Signal ${signal} delivered`,
      runId: result.runId,
      token,
      signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resume hook";
    return Response.json(
      { ok: false, error: { code: "HOOK_RESUME_FAILED", message } },
      { status: 500 }
    );
  }
}
