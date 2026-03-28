// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { resumeWebhook } from "workflow/api";

type WebhookRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, { params }: WebhookRouteContext) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  if (!decoded) {
    return Response.json(
      { ok: false, error: { code: "MISSING_TOKEN", message: "token is required" } },
      { status: 400 }
    );
  }

  try {
    const response = await resumeWebhook(decoded, request);
    return response;
  } catch {
    return Response.json(
      { ok: false, error: { code: "WEBHOOK_NOT_FOUND", message: "Webhook not found or already settled" } },
      { status: 404 }
    );
  }
}
