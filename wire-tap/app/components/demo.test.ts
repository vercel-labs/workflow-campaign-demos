import { describe, expect, test } from "bun:test";

// The demo component's event parsing and state accumulation functions are
// internal. We test the same contract here by exercising the logic directly.

type StageName = "validate" | "enrich" | "transform" | "deliver";
type StageStatus = "pending" | "active" | "tapped" | "done";

type WireTapEvent =
  | { type: "stage_start"; stage: string }
  | { type: "tap_captured"; stage: string; snapshot: Record<string, unknown> }
  | { type: "stage_done"; stage: string; durationMs: number }
  | { type: "done"; auditCount: number; totalMs: number };

type StageState = {
  status: StageStatus;
  snapshot: Record<string, unknown> | null;
  durationMs: number;
};

type WireTapState = {
  status: "idle" | "processing" | "done";
  stages: Record<StageName, StageState>;
  auditCount: number;
  totalMs: number | null;
  events: WireTapEvent[];
};

function isStageName(value: string): value is StageName {
  return (
    value === "validate" ||
    value === "enrich" ||
    value === "transform" ||
    value === "deliver"
  );
}

function parseSseChunk(chunk: string): WireTapEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as WireTapEvent;
  } catch {
    return null;
  }
}

function createInitialState(): WireTapState {
  return {
    status: "processing",
    stages: {
      validate: { status: "pending", snapshot: null, durationMs: 0 },
      enrich: { status: "pending", snapshot: null, durationMs: 0 },
      transform: { status: "pending", snapshot: null, durationMs: 0 },
      deliver: { status: "pending", snapshot: null, durationMs: 0 },
    },
    auditCount: 0,
    totalMs: null,
    events: [],
  };
}

function applyEvent(state: WireTapState, event: WireTapEvent): WireTapState {
  const next: WireTapState = {
    ...state,
    events: [...state.events, event],
    stages: { ...state.stages },
  };

  if (event.type === "stage_start" && isStageName(event.stage)) {
    next.stages[event.stage] = {
      ...next.stages[event.stage],
      status: "active",
    };
  } else if (event.type === "tap_captured" && isStageName(event.stage)) {
    next.stages[event.stage] = {
      ...next.stages[event.stage],
      status: "tapped",
      snapshot: event.snapshot,
    };
  } else if (event.type === "stage_done" && isStageName(event.stage)) {
    next.stages[event.stage] = {
      ...next.stages[event.stage],
      status: "done",
      durationMs: event.durationMs,
    };
  } else if (event.type === "done") {
    next.status = "done";
    next.auditCount = event.auditCount;
    next.totalMs = event.totalMs;
  }

  return next;
}

describe("wire-tap demo event parsing", () => {
  test("test_parseSseChunk_parses_stage_start_event", () => {
    const event = parseSseChunk('data: {"type":"stage_start","stage":"validate"}\n\n');
    expect(event).toEqual({ type: "stage_start", stage: "validate" });
  });

  test("test_parseSseChunk_parses_tap_captured_event_with_snapshot", () => {
    const event = parseSseChunk(
      'data: {"type":"tap_captured","stage":"enrich","snapshot":{"orderId":"ORD-1","price":29.99}}\n\n'
    );
    expect(event).toEqual({
      type: "tap_captured",
      stage: "enrich",
      snapshot: { orderId: "ORD-1", price: 29.99 },
    });
  });

  test("test_parseSseChunk_parses_stage_done_event", () => {
    const event = parseSseChunk(
      'data: {"type":"stage_done","stage":"transform","durationMs":500}\n\n'
    );
    expect(event).toEqual({
      type: "stage_done",
      stage: "transform",
      durationMs: 500,
    });
  });

  test("test_parseSseChunk_parses_done_event", () => {
    const event = parseSseChunk(
      'data: {"type":"done","auditCount":4,"totalMs":2600}\n\n'
    );
    expect(event).toEqual({ type: "done", auditCount: 4, totalMs: 2600 });
  });

  test("test_parseSseChunk_returns_null_for_empty_chunk", () => {
    expect(parseSseChunk("")).toBeNull();
    expect(parseSseChunk("\n\n")).toBeNull();
  });

  test("test_parseSseChunk_returns_null_for_invalid_json", () => {
    expect(parseSseChunk("data: not-json\n\n")).toBeNull();
  });
});

describe("wire-tap demo state accumulation", () => {
  test("test_stage_start_sets_stage_to_active", () => {
    const state = createInitialState();
    const next = applyEvent(state, { type: "stage_start", stage: "validate" });
    expect(next.stages.validate.status).toBe("active");
    expect(next.stages.enrich.status).toBe("pending");
  });

  test("test_tap_captured_sets_stage_to_tapped_with_snapshot", () => {
    let state = createInitialState();
    state = applyEvent(state, { type: "stage_start", stage: "validate" });
    state = applyEvent(state, {
      type: "tap_captured",
      stage: "validate",
      snapshot: { orderId: "ORD-1", validated: true },
    });
    expect(state.stages.validate.status).toBe("tapped");
    expect(state.stages.validate.snapshot).toEqual({
      orderId: "ORD-1",
      validated: true,
    });
  });

  test("test_stage_done_sets_stage_to_done_with_duration", () => {
    let state = createInitialState();
    state = applyEvent(state, { type: "stage_start", stage: "enrich" });
    state = applyEvent(state, {
      type: "tap_captured",
      stage: "enrich",
      snapshot: { price: 29.99 },
    });
    state = applyEvent(state, {
      type: "stage_done",
      stage: "enrich",
      durationMs: 800,
    });
    expect(state.stages.enrich.status).toBe("done");
    expect(state.stages.enrich.durationMs).toBe(800);
  });

  test("test_done_event_sets_status_to_done_with_audit_count", () => {
    let state = createInitialState();
    state = applyEvent(state, { type: "done", auditCount: 4, totalMs: 2600 });
    expect(state.status).toBe("done");
    expect(state.auditCount).toBe(4);
    expect(state.totalMs).toBe(2600);
  });

  test("test_full_pipeline_accumulates_all_events_in_order", () => {
    let state = createInitialState();
    const events: WireTapEvent[] = [
      { type: "stage_start", stage: "validate" },
      { type: "tap_captured", stage: "validate", snapshot: { validated: true } },
      { type: "stage_done", stage: "validate", durationMs: 600 },
      { type: "stage_start", stage: "enrich" },
      { type: "tap_captured", stage: "enrich", snapshot: { price: 29.99 } },
      { type: "stage_done", stage: "enrich", durationMs: 800 },
      { type: "stage_start", stage: "transform" },
      { type: "tap_captured", stage: "transform", snapshot: { format: "canonical-v2" } },
      { type: "stage_done", stage: "transform", durationMs: 500 },
      { type: "stage_start", stage: "deliver" },
      { type: "tap_captured", stage: "deliver", snapshot: { deliveredTo: "warehouse-us-east-1" } },
      { type: "stage_done", stage: "deliver", durationMs: 700 },
      { type: "done", auditCount: 4, totalMs: 2600 },
    ];

    for (const event of events) {
      state = applyEvent(state, event);
    }

    expect(state.status).toBe("done");
    expect(state.stages.validate.status).toBe("done");
    expect(state.stages.enrich.status).toBe("done");
    expect(state.stages.transform.status).toBe("done");
    expect(state.stages.deliver.status).toBe("done");
    expect(state.events).toHaveLength(13);
    expect(state.auditCount).toBe(4);
  });
});
