import { defineHook, getWritable, sleep } from "workflow";

// Typed events streamed to the UI via getWritable()
export type GatewayEvent =
  | { type: "waiting"; orderId: string; tokens: Record<string, string>; timeoutMs: number }
  | { type: "signal_received"; orderId: string; signal: string; token: string }
  | { type: "all_received"; orderId: string }
  | { type: "shipping"; orderId: string }
  | { type: "shipped"; orderId: string }
  | { type: "timeout"; orderId: string; missing: string[] }
  | { type: "done"; orderId: string; status: "shipped" | "timeout" };

export const orderSignal = defineHook<{ ok: true }>();

const SIGNAL_KINDS = ["payment", "inventory", "fraud"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export async function eventGateway(orderId: string, timeoutMs: number = 10_000) {
  "use workflow";

  const tokens: Record<string, string> = {};
  const hooks = SIGNAL_KINDS.map((kind) => {
    const token = `${kind}:${orderId}`;
    tokens[kind] = token;
    return { kind, hook: orderSignal.create({ token }), token };
  });

  await emit<GatewayEvent>({
    type: "waiting",
    orderId,
    tokens,
    timeoutMs,
  });

  // Track which signals have been received
  const received = new Set<string>();

  const signalPromises = hooks.map(({ kind, hook, token }) =>
    hook.then(() => {
      received.add(kind);
      return { kind, token };
    })
  );

  const outcome = await Promise.race([
    Promise.all(signalPromises).then((results) => ({ type: "ready" as const, results })),
    sleep(`${timeoutMs}ms`).then(() => ({ type: "timeout" as const, results: [] as { kind: string; token: string }[] })),
  ]);

  // Emit signal_received events for all signals that arrived
  for (const { kind, token } of outcome.results) {
    await emit<GatewayEvent>({ type: "signal_received", orderId, signal: kind, token });
  }

  if (outcome.type === "timeout") {
    const missing = SIGNAL_KINDS.filter((k) => !received.has(k));
    await emit<GatewayEvent>({ type: "timeout", orderId, missing });
    await emit<GatewayEvent>({ type: "done", orderId, status: "timeout" });
    return { orderId, status: "timeout" as const };
  }

  await emit<GatewayEvent>({ type: "all_received", orderId });
  await emit<GatewayEvent>({ type: "shipping", orderId });
  await shipOrder(orderId);
  await emit<GatewayEvent>({ type: "shipped", orderId });
  await emit<GatewayEvent>({ type: "done", orderId, status: "shipped" });
  return { orderId, status: "shipped" as const };
}

/**
 * Step: Emit a single event to the UI stream.
 * Re-acquires the writer inside the step so it survives durable suspension.
 */
async function emit<T>(event: T): Promise<void> {
  "use step";
  const writer = getWritable<T>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function shipOrder(orderId: string) {
  "use step";
  // Simulate shipping API call
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.info("[event-gateway] ship_order", { orderId });
}
