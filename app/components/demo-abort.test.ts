import { describe, expect, test } from "bun:test";

import { ensureActiveAbortController } from "./demo";

describe("fan-out abort controller lifecycle", () => {
  test("test_ensureActiveAbortController_creates_controller_when_previous_is_null", () => {
    const controller = ensureActiveAbortController(null);

    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);
  });

  test("test_ensureActiveAbortController_reuses_controller_when_previous_is_active", () => {
    const existing = new AbortController();

    const controller = ensureActiveAbortController(existing);

    expect(controller).toBe(existing);
  });

  test("test_ensureActiveAbortController_replaces_controller_when_previous_is_aborted", () => {
    const existing = new AbortController();
    existing.abort();

    const controller = ensureActiveAbortController(existing);

    expect(controller).not.toBe(existing);
    expect(controller.signal.aborted).toBe(false);
  });
});
