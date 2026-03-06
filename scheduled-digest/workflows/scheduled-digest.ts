import { sleep, defineHook, getWritable } from "workflow";

export type DigestEventPayload = {
  type: string;
  message: string;
};

export const digestEvent = defineHook<DigestEventPayload>();

export type DigestStreamEvent =
  | { type: "window_open"; token: string; windowMs: number }
  | { type: "event_received"; event: DigestEventPayload; eventCount: number }
  | { type: "sleep_tick" }
  | { type: "window_closed"; eventCount: number }
  | { type: "sending_digest"; eventCount: number }
  | { type: "digest_sent"; eventCount: number }
  | { type: "digest_empty" }
  | { type: "done"; status: "sent" | "empty"; eventCount: number };

export interface DigestResult {
  digestId: string;
  userId: string;
  token: string;
  status: "sent" | "empty";
  eventCount: number;
  windowMs: number;
}

const DEMO_WINDOW_MS = 6_000;

export async function collectAndSendDigest(
  digestId: string,
  userId: string,
  windowMs: number = DEMO_WINDOW_MS
): Promise<DigestResult> {
  "use workflow";

  const token = `digest:${digestId}`;
  const hook = digestEvent.create({ token });
  const windowClosed = sleep(`${windowMs}ms`).then(() => ({
    kind: "window_closed" as const,
  }));
  const events: DigestEventPayload[] = [];

  await emitWindowOpen(token, windowMs);

  while (true) {
    const outcome = await Promise.race([
      hook.then((payload) => ({
        kind: "event" as const,
        payload,
      })),
      windowClosed,
    ]);

    if (outcome.kind === "window_closed") {
      await emitWindowClosed(events.length);
      break;
    }

    events.push(outcome.payload);
    await emitEventReceived(outcome.payload, events.length);
  }

  if (events.length === 0) {
    await emitDigestEmpty();
    return {
      digestId,
      userId,
      token,
      status: "empty",
      eventCount: 0,
      windowMs,
    };
  }

  await sendDigestEmail(userId, events);

  await emitDone("sent", events.length);

  return {
    digestId,
    userId,
    token,
    status: "sent",
    eventCount: events.length,
    windowMs,
  };
}

async function emitWindowOpen(token: string, windowMs: number) {
  "use step";
  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "window_open", token, windowMs });
  } finally {
    writer.releaseLock();
  }
}

async function emitEventReceived(event: DigestEventPayload, eventCount: number) {
  "use step";
  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "event_received", event, eventCount });
  } finally {
    writer.releaseLock();
  }
}

async function emitWindowClosed(eventCount: number) {
  "use step";
  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "window_closed", eventCount });
  } finally {
    writer.releaseLock();
  }
}

async function emitDigestEmpty() {
  "use step";
  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "digest_empty" });
    await writer.write({ type: "done", status: "empty", eventCount: 0 });
  } finally {
    writer.releaseLock();
  }
}

async function emitDone(status: "sent" | "empty", eventCount: number) {
  "use step";
  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "done", status, eventCount });
  } finally {
    writer.releaseLock();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendDigestEmail(
  userId: string,
  events: DigestEventPayload[]
): Promise<void> {
  "use step";

  const writer = getWritable<DigestStreamEvent>().getWriter();
  try {
    await writer.write({ type: "sending_digest", eventCount: events.length });
    await delay(500);
    await writer.write({ type: "digest_sent", eventCount: events.length });
  } finally {
    writer.releaseLock();
  }

  console.info("[scheduled-digest] send_digest", {
    userId,
    eventCount: events.length,
    types: events.map((e) => e.type),
  });
}
