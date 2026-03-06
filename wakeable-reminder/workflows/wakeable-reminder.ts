import { defineHook, getWritable, sleep } from "workflow";

export type ReminderAction =
  | { type: "cancel" }
  | { type: "send_now" }
  | { type: "snooze"; seconds: number };

export type ReminderResult = {
  userId: string;
  status: "sent" | "cancelled";
  sentAt?: string;
  token: string;
};

export type ReminderEvent =
  | { type: "scheduled"; userId: string; sendAtMs: number; token: string; metadata: { userId: string; initialSendAt: string; channel: string } }
  | { type: "sleeping"; sendAtMs: number }
  | { type: "action_received"; action: ReminderAction }
  | { type: "snoozed"; sendAtMs: number }
  | { type: "woke" }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "cancelled" }
  | { type: "done"; status: "sent" | "cancelled" };

export const reminderActionHook = defineHook<ReminderAction>();

export async function scheduleReminder(
  userId: string,
  delayMs: number
): Promise<ReminderResult> {
  "use workflow";

  let sendAt = new Date(Date.now() + delayMs);

  const action = reminderActionHook.create({
    token: `reminder:${userId}`,
    metadata: {
      userId,
      initialSendAt: sendAt.toISOString(),
      channel: "email",
    },
  });

  await emit<ReminderEvent>({
    type: "scheduled",
    userId,
    sendAtMs: sendAt.getTime(),
    token: action.token,
    metadata: {
      userId,
      initialSendAt: sendAt.toISOString(),
      channel: "email",
    },
  });
  await emit<ReminderEvent>({ type: "sleeping", sendAtMs: sendAt.getTime() });

  const outcome = await Promise.race([
    sleep(sendAt).then(() => ({ kind: "time" as const })),
    action.then((payload) => ({ kind: "action" as const, payload })),
  ]);

  if (outcome.kind === "action") {
    await emit<ReminderEvent>({ type: "action_received", action: outcome.payload });

    if (outcome.payload.type === "cancel") {
      await emit<ReminderEvent>({ type: "cancelled" });
      await emit<ReminderEvent>({ type: "done", status: "cancelled" });
      return { userId, status: "cancelled", token: action.token };
    }

    if (outcome.payload.type === "snooze") {
      sendAt = new Date(Date.now() + outcome.payload.seconds * 1000);
      await emit<ReminderEvent>({ type: "snoozed", sendAtMs: sendAt.getTime() });
      await sleep(sendAt);
    }

    if (outcome.payload.type === "send_now") {
      await emit<ReminderEvent>({ type: "woke" });
    }
  }

  await emit<ReminderEvent>({ type: "sending" });
  await sendReminderEmail(userId, sendAt);
  await emit<ReminderEvent>({ type: "sent" });
  await emit<ReminderEvent>({ type: "done", status: "sent" });

  return {
    userId,
    status: "sent",
    sentAt: sendAt.toISOString(),
    token: action.token,
  };
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

async function sendReminderEmail(userId: string, sendAt: Date) {
  "use step";
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[wakeable-reminder] send_email", {
    userId,
    scheduledFor: sendAt.toISOString(),
  });
}
