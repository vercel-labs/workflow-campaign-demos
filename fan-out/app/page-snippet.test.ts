import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/incident-fanout.ts", import.meta.url)
).text();

describe("fan-out page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_channel_aware_formatChannelError_helper_when_displayed", () => {
    expect(workflowSource).toContain("function formatChannelError(");
    expect(workflowSource).toContain("channel: NotificationChannel");
    expect(workflowSource).toContain("error: formatChannelError(channel, result.reason)");
    expect(workflowSource).toContain("return `${channel}: ${message}`;");
  });

  test("test_workflowSnippet_uses_deliveries_and_alert_step_function_names_for_workflow_parity", () => {
    expect(workflowSource).toContain(
      "const deliveries: ChannelResult[] = settled.map((result, index) => {"
    );
    expect(workflowSource).toContain("sendSlackAlert(");
    expect(workflowSource).toContain("sendEmailAlert(");
    expect(workflowSource).toContain("sendSmsAlert(");
    expect(workflowSource).toContain("sendPagerDutyAlert(");
    expect(workflowSource).toContain(
      "return aggregateResults(incidentId, message, deliveries);"
    );
  });
});
