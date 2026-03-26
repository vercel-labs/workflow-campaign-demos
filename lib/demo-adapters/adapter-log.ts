export type AdapterLogLevel = "info" | "error";

export type AdapterLogEvent = {
  level: AdapterLogLevel;
  scope: "adapter";
  adapter: string;
  action: string;
  [key: string]: unknown;
};

export function logAdapterEvent(event: AdapterLogEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  });

  if (event.level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}
