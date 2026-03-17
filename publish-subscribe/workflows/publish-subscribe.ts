import { getWritable, sleep } from "workflow";

export type Topic = "orders" | "inventory" | "shipping" | "analytics";

export type Subscriber = {
  id: string;
  name: string;
  topics: Topic[];
};

export type PubSubEvent =
  | { type: "subscribers_registered"; subscribers: Subscriber[] }
  | { type: "message_published"; topic: Topic; payload: string }
  | { type: "filtering"; topic: Topic; total: number; matched: number }
  | { type: "delivering"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "delivered"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "subscriber_skipped"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "done"; topic: Topic; delivered: number; skipped: number };

export interface PubSubResult {
  topic: Topic;
  delivered: number;
  skipped: number;
}

// Simulated subscriber registry — each subscriber listens to specific topics.
// In production this would come from a database or configuration service.
const SUBSCRIBER_REGISTRY: Subscriber[] = [
  { id: "sub-1", name: "Order Service", topics: ["orders", "inventory"] },
  { id: "sub-2", name: "Warehouse API", topics: ["inventory", "shipping"] },
  { id: "sub-3", name: "Email Notifier", topics: ["orders", "shipping"] },
  { id: "sub-4", name: "Analytics Pipeline", topics: ["orders", "inventory", "shipping", "analytics"] },
  { id: "sub-5", name: "Billing Service", topics: ["orders"] },
];

// Demo timing
const REGISTER_DELAY_MS = 400;
const FILTER_DELAY_MS = 500;
const DELIVER_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function publishSubscribeFlow(
  topic: Topic,
  payload: string
): Promise<PubSubResult> {
  "use workflow";

  // Step 1: Register subscribers from the registry
  const subscribers = await registerSubscribers();

  // Step 2: Publish message and filter by topic subscription
  const matched = await filterSubscribers(topic, payload, subscribers);

  // Step 3: Deliver to each matching subscriber
  const delivered = await deliverToSubscribers(topic, matched);

  // Step 4: Summarize results
  return summarizeDelivery(topic, delivered, subscribers.length - matched.length);
}

async function registerSubscribers(): Promise<Subscriber[]> {
  "use step";
  const writer = getWritable<PubSubEvent>().getWriter();
  try {
    await delay(REGISTER_DELAY_MS);
    await writer.write({
      type: "subscribers_registered",
      subscribers: SUBSCRIBER_REGISTRY,
    });
    return SUBSCRIBER_REGISTRY;
  } finally {
    writer.releaseLock();
  }
}

async function filterSubscribers(
  topic: Topic,
  payload: string,
  subscribers: Subscriber[]
): Promise<Subscriber[]> {
  "use step";
  const writer = getWritable<PubSubEvent>().getWriter();
  try {
    await writer.write({ type: "message_published", topic, payload });
    await delay(FILTER_DELAY_MS);

    const matched = subscribers.filter((sub) => sub.topics.includes(topic));

    await writer.write({
      type: "filtering",
      topic,
      total: subscribers.length,
      matched: matched.length,
    });

    // Emit skip events for non-matching subscribers
    for (const sub of subscribers) {
      if (!sub.topics.includes(topic)) {
        await writer.write({
          type: "subscriber_skipped",
          subscriberId: sub.id,
          subscriberName: sub.name,
          topic,
        });
      }
    }

    return matched;
  } finally {
    writer.releaseLock();
  }
}

async function deliverToSubscribers(
  topic: Topic,
  subscribers: Subscriber[]
): Promise<number> {
  "use step";
  const writer = getWritable<PubSubEvent>().getWriter();
  try {
    let delivered = 0;

    for (const sub of subscribers) {
      await writer.write({
        type: "delivering",
        subscriberId: sub.id,
        subscriberName: sub.name,
        topic,
      });
      await delay(DELIVER_DELAY_MS);
      await writer.write({
        type: "delivered",
        subscriberId: sub.id,
        subscriberName: sub.name,
        topic,
      });
      delivered += 1;
    }

    return delivered;
  } finally {
    writer.releaseLock();
  }
}

async function summarizeDelivery(
  topic: Topic,
  delivered: number,
  skipped: number
): Promise<PubSubResult> {
  "use step";
  const writer = getWritable<PubSubEvent>().getWriter();
  try {
    await writer.write({ type: "done", topic, delivered, skipped });
    return { topic, delivered, skipped };
  } finally {
    writer.releaseLock();
  }
}
