import { describe, test, expect } from "bun:test";

// Unit-test the routing rules in isolation
const RULES = [
  { channel: "slack", match: () => true },
  { channel: "email", match: (s: string) => s === "warning" || s === "critical" },
  { channel: "pagerduty", match: (s: string) => s === "critical" },
  { channel: "webhook", match: (s: string) => s !== "info" },
];

describe("recipient-list routing rules", () => {
  test("info severity only matches slack", () => {
    const matched = RULES.filter((r) => r.match("info")).map((r) => r.channel);
    expect(matched).toEqual(["slack"]);
  });

  test("warning severity matches slack, email, webhook", () => {
    const matched = RULES.filter((r) => r.match("warning")).map((r) => r.channel);
    expect(matched).toEqual(["slack", "email", "webhook"]);
  });

  test("critical severity matches all four channels", () => {
    const matched = RULES.filter((r) => r.match("critical")).map((r) => r.channel);
    expect(matched).toEqual(["slack", "email", "pagerduty", "webhook"]);
  });

  test("skipped channels are the complement of matched", () => {
    const allChannels = RULES.map((r) => r.channel);
    for (const severity of ["info", "warning", "critical"]) {
      const matched = RULES.filter((r) => r.match(severity)).map((r) => r.channel);
      const skipped = RULES.filter((r) => !r.match(severity)).map((r) => r.channel);
      expect([...matched, ...skipped].sort()).toEqual([...allChannels].sort());
    }
  });
});
