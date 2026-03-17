import { getWritable } from "workflow";

export type HedgeEvent =
  | { type: "config"; providers: string[]; query: string }
  | { type: "provider_started"; provider: string }
  | { type: "provider_responded"; provider: string; latencyMs: number }
  | { type: "provider_lost"; provider: string; latencyMs: number }
  | { type: "winner"; provider: string; latencyMs: number; result: string }
  | { type: "done"; winner: string; latencyMs: number; totalProviders: number };

export interface HedgeResult {
  winner: string;
  latencyMs: number;
  totalProviders: number;
}

export interface HedgeInput {
  query: string;
  providers: ProviderConfig[];
}

export type ProviderConfig = {
  name: string;
  simulatedLatencyMs: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function hedgeRequestFlow(
  input: HedgeInput
): Promise<HedgeResult> {
  "use workflow";

  const { query, providers } = input;

  await emitEvent({
    type: "config",
    providers: providers.map((p) => p.name),
    query,
  });

  // Launch all providers in parallel, race for fastest
  const raceResult = await Promise.race(
    providers.map((provider) => callProvider(provider, query))
  );

  // Mark losers
  for (const provider of providers) {
    if (provider.name !== raceResult.provider) {
      await emitEvent({
        type: "provider_lost",
        provider: provider.name,
        latencyMs: provider.simulatedLatencyMs,
      });
    }
  }

  await emitEvent({
    type: "done",
    winner: raceResult.provider,
    latencyMs: raceResult.latencyMs,
    totalProviders: providers.length,
  });

  return {
    winner: raceResult.provider,
    latencyMs: raceResult.latencyMs,
    totalProviders: providers.length,
  };
}

export async function callProvider(
  provider: ProviderConfig,
  query: string
): Promise<{ provider: string; latencyMs: number; result: string }> {
  "use step";

  const writer = getWritable<HedgeEvent>().getWriter();
  try {
    await writer.write({
      type: "provider_started",
      provider: provider.name,
    });

    // Simulate variable latency
    await delay(provider.simulatedLatencyMs);

    const result = `${provider.name} processed "${query}"`;

    await writer.write({
      type: "provider_responded",
      provider: provider.name,
      latencyMs: provider.simulatedLatencyMs,
    });

    await writer.write({
      type: "winner",
      provider: provider.name,
      latencyMs: provider.simulatedLatencyMs,
      result,
    });

    return {
      provider: provider.name,
      latencyMs: provider.simulatedLatencyMs,
      result,
    };
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: HedgeEvent): Promise<void> {
  "use step";
  const writer = getWritable<HedgeEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
