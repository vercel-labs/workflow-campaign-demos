import { describe, expect, test } from "bun:test";

const pageSource = await Bun.file(new URL("./page.tsx", import.meta.url)).text();

describe("fan-out page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_channel_aware_formatChannelError_helper_when_displayed", () => {
    expect(pageSource).toContain("function formatChannelError(");
    expect(pageSource).toContain("channel: NotificationChannel");
    expect(pageSource).toContain("error: formatChannelError(channel, result.reason)");
    expect(pageSource).toContain("return \\`\\${channel}: \\${message}\\`;");
  });

  test("test_workflowSnippet_uses_deliveries_and_alert_step_function_names_for_workflow_parity", () => {
    expect(pageSource).toContain(
      "const deliveries: ChannelResult[] = settled.map((result, index) => {"
    );
    expect(pageSource).toContain("sendSlackAlert(");
    expect(pageSource).toContain("sendEmailAlert(");
    expect(pageSource).toContain("sendSmsAlert(");
    expect(pageSource).toContain("sendPagerDutyAlert(");
    expect(pageSource).toContain(
      "return aggregateResults(incidentId, message, deliveries);"
    );
  });
});
