import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { competingConsumers } from "@/workflows/competing-consumers";

type CCRequestBody = {
  items?: unknown;
  consumers?: unknown;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  let body: CCRequestBody;

  try {
    body = (await request.json()) as CCRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = parseStringArray(body.items);
  const consumers = parseStringArray(body.consumers);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "items array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (consumers.length === 0) {
    return NextResponse.json(
      { error: "consumers array is required and must not be empty" },
      { status: 400 }
    );
  }

  const run = await start(competingConsumers, [items, consumers]);

  return NextResponse.json({
    runId: run.runId,
    items,
    consumers,
    status: "processing",
  });
}
