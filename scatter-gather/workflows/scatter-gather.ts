// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

export type ProviderId = "fedex" | "ups" | "dhl" | "usps";

export type ProviderEvent =
  | { type: "provider_querying"; provider: string }
  | { type: "provider_quoted"; provider: string; price: number; days: number }
  | { type: "provider_failed"; provider: string; error: string }
  | { type: "gathering" }
  | { type: "done"; winner: { provider: string; price: number; days: number } | null };

type ProviderQuote = {
  provider: ProviderId;
  price: number;
  days: number;
};

type ProviderResult = {
  provider: ProviderId;
  status: "quoted" | "failed";
  price?: number;
  days?: number;
  error?: string;
};

type ScatterGatherResult = {
  packageId: string;
  status: "done";
  results: ProviderResult[];
  winner: ProviderQuote | null;
};

// Demo: simulate real-world network latency so the UI can show progress.
const PROVIDER_DELAY_MS: Record<ProviderId, number> = {
  fedex: 700,
  ups: 900,
  dhl: 1100,
  usps: 1300,
};

const PROVIDER_QUOTES: Record<ProviderId, { price: number; days: number }> = {
  fedex: { price: 24.99, days: 2 },
  ups: { price: 19.50, days: 3 },
  dhl: { price: 31.00, days: 4 },
  usps: { price: 12.75, days: 5 },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scatterGather(
  packageId: string,
  failProviders: ProviderId[] = []
): Promise<ScatterGatherResult> {
  "use workflow";

  const providers: Array<{
    provider: ProviderId;
    fetch: () => Promise<ProviderQuote>;
  }> = [
    { provider: "fedex", fetch: () => fetchFedExQuote(packageId, failProviders) },
    { provider: "ups", fetch: () => fetchUpsQuote(packageId, failProviders) },
    { provider: "dhl", fetch: () => fetchDhlQuote(packageId, failProviders) },
    { provider: "usps", fetch: () => fetchUspsQuote(packageId, failProviders) },
  ];

  const settled = await Promise.allSettled(
    providers.map((p) => p.fetch())
  );

  const results: ProviderResult[] = settled.map((result, index) => {
    const provider = providers[index].provider;

    if (result.status === "fulfilled") {
      return {
        provider,
        status: "quoted",
        price: result.value.price,
        days: result.value.days,
      };
    }

    return {
      provider,
      status: "failed",
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    };
  });

  return gatherBestQuote(packageId, results);
}

async function fetchProviderQuote(
  provider: ProviderId,
  packageId: string,
  failProviders: ProviderId[]
): Promise<ProviderQuote> {
  // Demo: stream progress events to the UI via getWritable()
  const writer = getWritable<ProviderEvent>().getWriter();

  try {
    await writer.write({ type: "provider_querying", provider });
    await delay(PROVIDER_DELAY_MS[provider]);

    if (failProviders.includes(provider)) {
      const error = `${provider.toUpperCase()} service unavailable`;
      await writer.write({ type: "provider_failed", provider, error });
      throw new Error(error);
    }

    const quote = PROVIDER_QUOTES[provider];
    await writer.write({
      type: "provider_quoted",
      provider,
      price: quote.price,
      days: quote.days,
    });

    return { provider, price: quote.price, days: quote.days };
  } finally {
    writer.releaseLock();
  }
}

async function fetchFedExQuote(
  packageId: string,
  failProviders: ProviderId[]
): Promise<ProviderQuote> {
  "use step";
  return fetchProviderQuote("fedex", packageId, failProviders);
}

async function fetchUpsQuote(
  packageId: string,
  failProviders: ProviderId[]
): Promise<ProviderQuote> {
  "use step";
  return fetchProviderQuote("ups", packageId, failProviders);
}

async function fetchDhlQuote(
  packageId: string,
  failProviders: ProviderId[]
): Promise<ProviderQuote> {
  "use step";
  return fetchProviderQuote("dhl", packageId, failProviders);
}

async function fetchUspsQuote(
  packageId: string,
  failProviders: ProviderId[]
): Promise<ProviderQuote> {
  "use step";
  return fetchProviderQuote("usps", packageId, failProviders);
}

async function gatherBestQuote(
  packageId: string,
  results: ProviderResult[]
): Promise<ScatterGatherResult> {
  "use step";
  const writer = getWritable<ProviderEvent>().getWriter();

  try {
    await writer.write({ type: "gathering" });
    await delay(500);

    const quotes = results.filter(
      (r): r is ProviderResult & { price: number; days: number } =>
        r.status === "quoted" && r.price !== undefined && r.days !== undefined
    );

    const winner =
      quotes.length > 0
        ? quotes.reduce((best, current) =>
            current.price < best.price ? current : best
          )
        : null;

    await writer.write({
      type: "done",
      winner: winner
        ? { provider: winner.provider, price: winner.price, days: winner.days }
        : null,
    });

    return {
      packageId,
      status: "done",
      results,
      winner: winner
        ? { provider: winner.provider, price: winner.price, days: winner.days }
        : null,
    };
  } finally {
    writer.releaseLock();
  }
}
