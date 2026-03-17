import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  publishSubscribeFlow,
  type Topic,
} from "@/workflows/publish-subscribe";

type RequestBody = {
  topic?: unknown;
  payload?: unknown;
};

const VALID_TOPICS = new Set<Topic>(["orders", "inventory", "shipping", "analytics"]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic =
    typeof body.topic === "string" && VALID_TOPICS.has(body.topic as Topic)
      ? (body.topic as Topic)
      : null;
  const payload =
    typeof body.payload === "string" ? body.payload.trim() : "";

  if (!topic) {
    return NextResponse.json({ error: "topic is required (orders | inventory | shipping | analytics)" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const run = await start(publishSubscribeFlow, [topic, payload]);

  return NextResponse.json({
    runId: run.runId,
    topic,
    payload,
    status: "publishing",
  });
}
