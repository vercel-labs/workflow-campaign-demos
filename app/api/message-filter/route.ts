import { start } from "workflow/api";
import { orderFilter } from "../../../workflows/order-filter";
import type { DemoConfig } from "../../../workflows/order-filter";

export async function POST(request: Request) {
  const body = (await request.json()) as { config?: Partial<DemoConfig> };
  const { runId } = await start(orderFilter, [body.config]);

  return Response.json({
    runId,
    config: body.config,
    status: "filtering",
  });
}
