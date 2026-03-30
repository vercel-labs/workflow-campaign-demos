// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { getFanOutCodeProps } from "@/lib/generated/demo-code-props/fan-out";
import { getSagaCodeProps } from "@/lib/generated/demo-code-props/saga";
import { getCircuitBreakerCodeProps } from "@/lib/generated/demo-code-props/circuit-breaker";
import { getSplitterCodeProps } from "@/lib/generated/demo-code-props/splitter";
import { getDeadLetterQueueCodeProps } from "@/lib/generated/demo-code-props/dead-letter-queue";

export async function getNativeDemoCodeProps(
  slug: string,
): Promise<Record<string, unknown>> {
  switch (slug) {
    case "aggregator":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        stepCode: "",
        stepHtmlLines: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "approval-chain":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "approval-gate":
      return {};
    case "async-request-reply":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        callbackHtmlLines: [],
        callbackLineMap: {},
      };
    case "batch-processor":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "bulkhead":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "cancellable-export":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCodes: [],
        stepLinesHtml: [],
        highlightLineMap: {},
        sectionNames: [],
        sectionContent: [],
      };
    case "choreography":
      return {
        flowCode: "",
        flowHtmlLines: [],
        flowLineMap: {},
        participantCode: "",
        participantHtmlLines: [],
        participantLineMap: {},
      };
    case "circuit-breaker":
      return getCircuitBreakerCodeProps();
    case "claim-check":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "competing-consumers":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "content-based-router":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "content-enricher":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "correlation-identifier":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "dead-letter-queue":
      return getDeadLetterQueueCodeProps();
    case "detour":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "event-gateway":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "event-sourcing":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        stepCode: "",
        stepHtmlLines: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "fan-out":
      return getFanOutCodeProps();
    case "guaranteed-delivery":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "hedge-request":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "idempotent-receiver":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "map-reduce":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "message-filter":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "message-history":
      return {
        orchestratorCode: "",
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "message-translator":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "namespaced-streams":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "normalizer":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "onboarding-drip":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCodes: [],
        stepLinesHtml: [],
        stepSendLines: {},
        stepSleepLines: {},
      };
    case "pipeline":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
        workflowDirective: "",
        stepDirective: "",
      };
    case "priority-queue":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "process-manager":
      return {
        orchestratorCode: "",
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "publish-subscribe":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "recipient-list":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepRetryLineMap: {},
        stepSuccessLineMap: {},
      };
    case "request-reply":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "resequencer":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "retry-backoff":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "retryable-rate-limit":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "routing-slip":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
      };
    case "saga":
      return getSagaCodeProps();
    case "scatter-gather":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepSuccessLineMap: {},
      };
    case "scheduled-digest":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "scheduler-agent-supervisor":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "splitter":
      return getSplitterCodeProps();
    case "status-poller":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "throttle":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "transactional-outbox":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    case "wakeable-reminder":
      return {
        workflowCode: "",
        workflowHtmlLines: [],
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "webhook-basics":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "wire-tap":
      return {
        workflowCode: "",
        workflowLinesHtml: [],
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
      };
    default:
      return {};
  }
}
