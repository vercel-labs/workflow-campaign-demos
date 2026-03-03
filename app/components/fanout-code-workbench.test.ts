import { describe, expect, test } from "bun:test";

import { syncPreviousFanOutGutterMarks } from "./fanout-code-workbench";

type TestGutterMarkKind = "success" | "fail";

describe("fan-out code pane gutter marks", () => {
  test("test_syncPreviousFanOutGutterMarks_clears_cached_marks_when_full_reset_state_is_received", () => {
    const previousMarks = new Map<number, TestGutterMarkKind>([
      [4, "success"],
      [9, "fail"],
    ]);

    syncPreviousFanOutGutterMarks({
      previousMarks,
      gutterMarkMap: new Map(),
      gutterMarkCount: 0,
      activeLineCount: 0,
    });

    expect(previousMarks.size).toBe(0);
  });

  test("test_syncPreviousFanOutGutterMarks_preserves_cached_marks_when_active_lines_are_still_running", () => {
    const previousMarks = new Map<number, TestGutterMarkKind>([[6, "success"]]);

    syncPreviousFanOutGutterMarks({
      previousMarks,
      gutterMarkMap: new Map(),
      gutterMarkCount: 0,
      activeLineCount: 2,
    });

    expect([...previousMarks.entries()]).toEqual([[6, "success"]]);
  });

  test("test_syncPreviousFanOutGutterMarks_accumulates_latest_gutter_mark_entries", () => {
    const previousMarks = new Map<number, TestGutterMarkKind>([[1, "success"]]);
    const nextMarks = new Map<number, TestGutterMarkKind>([
      [3, "fail"],
      [8, "success"],
    ]);

    syncPreviousFanOutGutterMarks({
      previousMarks,
      gutterMarkMap: nextMarks,
      gutterMarkCount: nextMarks.size,
      activeLineCount: 0,
    });

    expect([...previousMarks.entries()]).toEqual([
      [1, "success"],
      [3, "fail"],
      [8, "success"],
    ]);
  });
});
