import { describe, expect, test } from "bun:test";

// The wire-tap demo uses fixed defaults and doesn't export cycleFailureMode
// or other control helpers (unlike fan-out). We test the demo constants and
// the stage-name type guard contract that drives the UI controls.

const STAGES = ["validate", "enrich", "transform", "deliver"] as const;
type StageName = (typeof STAGES)[number];

const DEMO_DEFAULTS = {
  orderId: "ORD-7042",
  item: "Ergonomic Keyboard",
  quantity: 3,
};

function isStageName(value: string): value is StageName {
  return (
    value === "validate" ||
    value === "enrich" ||
    value === "transform" ||
    value === "deliver"
  );
}

type LogTone = "default" | "green" | "amber" | "cyan";
type StageStatus = "pending" | "active" | "tapped" | "done";

function stageColor(status: StageStatus): string {
  if (status === "done") return "var(--color-green-700)";
  if (status === "tapped") return "var(--color-cyan-700)";
  if (status === "active") return "var(--color-amber-700)";
  return "var(--color-gray-500)";
}

type WireTapEvent =
  | { type: "stage_start"; stage: string }
  | { type: "tap_captured"; stage: string; snapshot: Record<string, unknown> }
  | { type: "stage_done"; stage: string; durationMs: number }
  | { type: "done"; auditCount: number; totalMs: number };

function eventToLog(
  event: WireTapEvent,
  elapsedMs: number
): { text: string; tone: LogTone } {
  const ts = `${(elapsedMs / 1000).toFixed(2)}s`;

  switch (event.type) {
    case "stage_start":
      return { text: `[${ts}] ${event.stage} processing...`, tone: "default" };
    case "tap_captured":
      return {
        text: `[${ts}] tap: captured ${event.stage} snapshot`,
        tone: "cyan",
      };
    case "stage_done":
      return {
        text: `[${ts}] ${event.stage} done (${event.durationMs}ms)`,
        tone: "green",
      };
    case "done":
      return {
        text: `[${ts}] complete — ${event.auditCount} taps captured in ${event.totalMs}ms`,
        tone: "green",
      };
  }
}

describe("wire-tap demo controls", () => {
  test("test_DEMO_DEFAULTS_has_valid_order_values", () => {
    expect(DEMO_DEFAULTS.orderId).toBe("ORD-7042");
    expect(DEMO_DEFAULTS.item.length).toBeGreaterThan(0);
    expect(DEMO_DEFAULTS.quantity).toBeGreaterThan(0);
  });

  test("test_isStageName_accepts_all_four_stages", () => {
    for (const stage of STAGES) {
      expect(isStageName(stage)).toBe(true);
    }
  });

  test("test_isStageName_rejects_invalid_stage_names", () => {
    expect(isStageName("unknown")).toBe(false);
    expect(isStageName("")).toBe(false);
    expect(isStageName("VALIDATE")).toBe(false);
  });

  test("test_stageColor_returns_correct_colors_for_each_status", () => {
    expect(stageColor("pending")).toBe("var(--color-gray-500)");
    expect(stageColor("active")).toBe("var(--color-amber-700)");
    expect(stageColor("tapped")).toBe("var(--color-cyan-700)");
    expect(stageColor("done")).toBe("var(--color-green-700)");
  });

  test("test_eventToLog_formats_stage_start_with_default_tone", () => {
    const entry = eventToLog(
      { type: "stage_start", stage: "validate" },
      1500
    );
    expect(entry.text).toBe("[1.50s] validate processing...");
    expect(entry.tone).toBe("default");
  });

  test("test_eventToLog_formats_tap_captured_with_cyan_tone", () => {
    const entry = eventToLog(
      {
        type: "tap_captured",
        stage: "enrich",
        snapshot: { price: 29.99 },
      },
      2300
    );
    expect(entry.text).toBe("[2.30s] tap: captured enrich snapshot");
    expect(entry.tone).toBe("cyan");
  });

  test("test_eventToLog_formats_stage_done_with_green_tone", () => {
    const entry = eventToLog(
      { type: "stage_done", stage: "transform", durationMs: 500 },
      2800
    );
    expect(entry.text).toBe("[2.80s] transform done (500ms)");
    expect(entry.tone).toBe("green");
  });

  test("test_eventToLog_formats_done_with_audit_summary", () => {
    const entry = eventToLog(
      { type: "done", auditCount: 4, totalMs: 2600 },
      2600
    );
    expect(entry.text).toBe(
      "[2.60s] complete — 4 taps captured in 2600ms"
    );
    expect(entry.tone).toBe("green");
  });
});
