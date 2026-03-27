"use client";

import { useEffect, useRef, useState } from "react";

type ReminderEvent =
  | { type: "scheduled"; userId: string; sendAtMs: number; token: string }
  | { type: "sleeping"; sendAtMs: number }
  | { type: "action_received"; action: { type: string; seconds?: number } }
  | { type: "snoozed"; sendAtMs: number }
  | { type: "woke" }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "cancelled" }
  | { type: "done"; status: "sent" | "cancelled" };

function parseEvent(chunk: string): ReminderEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as ReminderEvent;
  } catch {
    return null;
  }
}

export function WakeableReminderDemo() {
  const [userId, setUserId] = useState("user_123");
  const [delayMs, setDelayMs] = useState(8000);
  const [runId, setRunId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sleeping" | "sending" | "sent" | "cancelled">("idle");
  const [sendAtLabel, setSendAtLabel] = useState<string>("Pending");
  const [events, setEvents] = useState<string[]>(["Start a run to put the workflow to sleep until delivery time."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Readable stream unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseEvent(chunk);
        if (!event) continue;

        if (event.type === "scheduled") {
          setToken(event.token);
          setSendAtLabel(new Date(event.sendAtMs).toLocaleTimeString());
          setStatus("sleeping");
          setEvents((current) => [...current, `Reminder scheduled for ${new Date(event.sendAtMs).toLocaleTimeString()}`]);
        }

        if (event.type === "sleeping") {
          setStatus("sleeping");
        }

        if (event.type === "snoozed") {
          setSendAtLabel(new Date(event.sendAtMs).toLocaleTimeString());
          setEvents((current) => [...current, `Reminder snoozed until ${new Date(event.sendAtMs).toLocaleTimeString()}`]);
        }

        if (event.type === "action_received") {
          setEvents((current) => [...current, `Wake action received: ${event.action.type}`]);
        }

        if (event.type === "sending") {
          setStatus("sending");
        }

        if (event.type === "sent") {
          setStatus("sent");
        }

        if (event.type === "cancelled") {
          setStatus("cancelled");
        }

        if (event.type === "done") {
          setStatus(event.status);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setToken(null);
    setSendAtLabel("Pending");
    setStatus("sleeping");
    setEvents(["Scheduling reminder workflow."]);
    setError(null);

    try {
      const response = await fetch("/api/wakeable-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, delayMs }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start wakeable reminder",
        );
      }

      setRunId(payload.runId);
      await connectToStream(payload.runId, abortRef.current.signal);
    } catch (runError) {
      if (runError instanceof Error && runError.name === "AbortError") return;
      setStatus("idle");
      setError(runError instanceof Error ? runError.message : "Unknown error");
    }
  }

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Wakeable Reminder</p>
          <h2 className="text-xl font-semibold text-gray-950">Sleep durably until the reminder should fire</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "sleeping" || status === "sending"}
        >
          {status === "sleeping" || status === "sending" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-700">
          User ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={status === "sleeping" || status === "sending"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Delay (ms)
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1000}
            step={1000}
            value={delayMs}
            onChange={(event) => setDelayMs(Number(event.target.value))}
            disabled={status === "sleeping" || status === "sending"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Wake token</dt>
              <dd className="truncate">{token ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Next send</dt>
              <dd>{sendAtLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Run ID</dt>
              <dd className="truncate">{runId ?? "Pending"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            Mounted gallery mode currently demonstrates the sleep-to-send path only.
          </p>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
