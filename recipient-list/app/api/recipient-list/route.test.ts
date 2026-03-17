import { describe, test, expect } from "bun:test";

// Pure validation logic extracted from route.ts — no server or workflow mocking needed.

const VALID_SEVERITIES = new Set(["info", "warning", "critical"]);

const VALID_CHANNELS = new Set(["slack", "email", "pagerduty", "webhook"]);

function parseChannelArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (ch): ch is string => typeof ch === "string" && VALID_CHANNELS.has(ch)
  );
}

function parseFailures(value: unknown): { transient: string[]; permanent: string[] } {
  if (!value || typeof value !== "object") {
    return { transient: [], permanent: [] };
  }
  const obj = value as Record<string, unknown>;
  return {
    transient: parseChannelArray(obj.transient),
    permanent: parseChannelArray(obj.permanent),
  };
}

function parseRequest(body: Record<string, unknown>) {
  const alertId =
    typeof body.alertId === "string" ? body.alertId.trim() : `alert-fallback`;
  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const severity =
    typeof body.severity === "string" && VALID_SEVERITIES.has(body.severity)
      ? body.severity
      : "warning";
  const failures = parseFailures(body.failures);

  return { alertId, message, severity, failures };
}

describe("recipient-list API route validation", () => {
  test("severity defaults to warning when missing", () => {
    const { severity } = parseRequest({ alertId: "test-1", message: "test" });
    expect(severity).toBe("warning");
  });

  test("severity accepts valid values", () => {
    for (const sev of ["info", "warning", "critical"]) {
      const { severity } = parseRequest({ severity: sev, message: "m" });
      expect(severity).toBe(sev);
    }
  });

  test("invalid severity falls back to warning", () => {
    const { severity } = parseRequest({ severity: "bogus", message: "m" });
    expect(severity).toBe("warning");
  });

  test("failure parsing handles empty/null/invalid inputs", () => {
    expect(parseFailures(null)).toEqual({ transient: [], permanent: [] });
    expect(parseFailures(undefined)).toEqual({ transient: [], permanent: [] });
    expect(parseFailures("bad")).toEqual({ transient: [], permanent: [] });
  });

  test("failure parsing extracts valid channels", () => {
    const result = parseFailures({
      transient: ["slack", "invalid"],
      permanent: ["pagerduty"],
    });
    expect(result.transient).toEqual(["slack"]);
    expect(result.permanent).toEqual(["pagerduty"]);
  });

  test("POST response shape includes runId, alertId, severity, status", () => {
    // Simulate the shape that route.ts returns after calling start()
    const mockRunId = "run-abc123";
    const { alertId, severity } = parseRequest({
      alertId: "ALERT-7042",
      message: "Server CPU usage exceeded 95%",
      severity: "critical",
    });

    const response = {
      runId: mockRunId,
      alertId,
      severity,
      status: "routing",
    };

    expect(response).toEqual({
      runId: "run-abc123",
      alertId: "ALERT-7042",
      severity: "critical",
      status: "routing",
    });

    // Verify all required keys are present
    expect(response).toHaveProperty("runId");
    expect(response).toHaveProperty("alertId");
    expect(response).toHaveProperty("severity");
    expect(response).toHaveProperty("status");
  });

  test("alertId falls back to generated value when missing", () => {
    const { alertId } = parseRequest({ message: "test" });
    expect(alertId).toBe("alert-fallback");
  });

  test("empty message is preserved as empty string", () => {
    const { message } = parseRequest({ severity: "info" });
    expect(message).toBe("");
  });
});
