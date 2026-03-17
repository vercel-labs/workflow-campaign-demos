import { start } from "workflow/api";
import { normalizer } from "../../../workflows/normalizer";
import type { DemoConfig } from "../../../workflows/normalizer";

export async function POST(request: Request) {
  const body = (await request.json()) as { config?: Partial<DemoConfig> };
  const { runId } = await start(normalizer, [body.config]);

  return Response.json({
    runId,
    config: body.config,
    status: "normalizing",
  });
}
