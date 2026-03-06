import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { enrichLeadProfile } from "@/workflows/content-enricher";

type EnrichRequestBody = {
  email?: unknown;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: EnrichRequestBody;

  try {
    body = (await request.json()) as EnrichRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const run = await start(enrichLeadProfile, [email]);

  return NextResponse.json(
    {
      runId: run.runId,
      email,
      message: "Lead enrichment started",
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
