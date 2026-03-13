// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getWritable } from "workflow";

export type OutboxEvent =
  | { type: "persisting"; orderId: string }
  | { type: "persisted"; orderId: string; outboxId: string }
  | { type: "relaying"; outboxId: string }
  | { type: "published"; outboxId: string; brokerId: string }
  | { type: "marking_sent"; outboxId: string }
  | { type: "confirmed"; outboxId: string }
  | { type: "done"; orderId: string; outboxId: string; brokerId: string };

type OutboxResult = {
  orderId: string;
  outboxId: string;
  brokerId: string;
  status: "confirmed";
};

// Demo: simulate real-world processing latency so the UI can show progress.
const PERSIST_DELAY_MS = 600;
const RELAY_DELAY_MS = 800;
const PUBLISH_DELAY_MS = 700;
const MARK_SENT_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transactionalOutbox(
  orderId: string,
  payload: string
): Promise<OutboxResult> {
  "use workflow";

  const { outboxId } = await persistOrder(orderId, payload);
  const { brokerId } = await pollRelay(outboxId);
  await publishEvent(outboxId, brokerId);
  return markSent(orderId, outboxId, brokerId);
}

async function persistOrder(
  orderId: string,
  payload: string
): Promise<{ outboxId: string }> {
  "use step";
  const writer = getWritable<OutboxEvent>().getWriter();

  try {
    await writer.write({ type: "persisting", orderId });
    await delay(PERSIST_DELAY_MS);

    const outboxId = `obx_${orderId}_${payload.length}`;
    await writer.write({ type: "persisted", orderId, outboxId });

    return { outboxId };
  } finally {
    writer.releaseLock();
  }
}

async function pollRelay(
  outboxId: string
): Promise<{ brokerId: string }> {
  "use step";
  const writer = getWritable<OutboxEvent>().getWriter();

  try {
    await writer.write({ type: "relaying", outboxId });
    await delay(RELAY_DELAY_MS);

    const brokerId = `brk_${outboxId}_${Date.now()}`;
    await writer.write({ type: "published", outboxId, brokerId });

    return { brokerId };
  } finally {
    writer.releaseLock();
  }
}

async function publishEvent(
  outboxId: string,
  brokerId: string
): Promise<void> {
  "use step";
  const writer = getWritable<OutboxEvent>().getWriter();

  try {
    await writer.write({ type: "marking_sent", outboxId });
    await delay(PUBLISH_DELAY_MS);

    await writer.write({ type: "confirmed", outboxId });
  } finally {
    writer.releaseLock();
  }
}

async function markSent(
  orderId: string,
  outboxId: string,
  brokerId: string
): Promise<OutboxResult> {
  "use step";
  const writer = getWritable<OutboxEvent>().getWriter();

  try {
    await delay(MARK_SENT_DELAY_MS);
    await writer.write({ type: "done", orderId, outboxId, brokerId });

    return { orderId, outboxId, brokerId, status: "confirmed" };
  } finally {
    writer.releaseLock();
  }
}
