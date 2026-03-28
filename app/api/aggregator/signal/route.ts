// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { aggregatorSignal, type SignalPayload } from "@/aggregator/workflows/aggregator";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, source, value } = body;

  if (typeof token !== "string" || token.trim().length === 0) {
    return Response.json({ error: "token is required" }, { status: 400 });
  }

  if (typeof source !== "string") {
    return Response.json({ error: "source is required" }, { status: 400 });
  }

  const numericValue = typeof value === "number" ? value : 0;

  const payload: SignalPayload = { source, value: numericValue };

  let result: Awaited<ReturnType<typeof aggregatorSignal.resume>>;
  try {
    result = await aggregatorSignal.resume(token.trim(), payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resume hook";
    return Response.json({ error: message }, { status: 500 });
  }

  if (!result) {
    return Response.json(
      { error: "Hook not found or already resolved" },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    source,
    value: numericValue,
    token: token.trim(),
    runId: result.runId,
  });
}
