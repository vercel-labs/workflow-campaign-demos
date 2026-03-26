import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_COMPLETE_VIRTUAL_MS,
  DAY_MS,
  STEP_DEFINITIONS,
  STEP_START_TIMES_MS,
  CAMPAIGN_SEGMENTS,
  clampVirtualTime,
  formatVirtualClock,
} from "./onboarding-drip-demo-state.ts";

test("clampVirtualTime clamps above campaign end", () => {
  assert.equal(
    clampVirtualTime(CAMPAIGN_COMPLETE_VIRTUAL_MS + DAY_MS),
    CAMPAIGN_COMPLETE_VIRTUAL_MS,
  );
});

test("clampVirtualTime returns 0 for invalid inputs", () => {
  assert.equal(clampVirtualTime(NaN), 0);
  assert.equal(clampVirtualTime(-100), 0);
  assert.equal(clampVirtualTime(Infinity), 0);
});

test("formatVirtualClock formats Day 0 correctly", () => {
  assert.equal(formatVirtualClock(0), "Day 0, 00:00");
});

test("formatVirtualClock formats Day 7 correctly", () => {
  assert.equal(formatVirtualClock(7 * DAY_MS), "Day 7, 00:00");
});

test("STEP_DEFINITIONS has 4 entries matching expected days", () => {
  assert.equal(STEP_DEFINITIONS.length, 4);
  assert.deepEqual(
    STEP_DEFINITIONS.map((s) => s.day),
    [0, 1, 3, 7],
  );
});

test("STEP_START_TIMES_MS matches day * DAY_MS", () => {
  for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
    assert.equal(STEP_START_TIMES_MS[i], STEP_DEFINITIONS[i].day * DAY_MS);
  }
});

test("CAMPAIGN_SEGMENTS covers full timeline", () => {
  assert.equal(CAMPAIGN_SEGMENTS[0].startMs, 0);
  assert.equal(
    CAMPAIGN_SEGMENTS[CAMPAIGN_SEGMENTS.length - 1].endMs,
    CAMPAIGN_COMPLETE_VIRTUAL_MS,
  );
});
