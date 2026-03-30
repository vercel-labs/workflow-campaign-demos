// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";
import { getFanOutCodeProps } from "@/lib/generated/demo-code-props/fan-out";
import { getSagaCodeProps } from "@/lib/generated/demo-code-props/saga";
import { getCircuitBreakerCodeProps } from "@/lib/generated/demo-code-props/circuit-breaker";
import { getSplitterCodeProps } from "@/lib/generated/demo-code-props/splitter";
import { getDeadLetterQueueCodeProps } from "@/lib/generated/demo-code-props/dead-letter-queue";

function readWorkflowSource(relPath: string): string {
  try {
    return readFileSync(join(process.cwd(), relPath), "utf-8");
  } catch {
    return "// Source not available";
  }
}

export async function getNativeDemoCodeProps(
  slug: string,
): Promise<Record<string, unknown>> {
  switch (slug) {
    case "aggregator": {
      const workflowCode = readWorkflowSource("aggregator/workflows/aggregator.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        stepCode: "",
        stepHtmlLines: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "approval-chain": {
      const workflowCode = readWorkflowSource("approval-chain/workflows/approval-chain.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "approval-gate":
      return {};
    case "async-request-reply":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        callbackHtmlLines: [],
        callbackLineMap: {},
      };
    case "batch-processor": {
      const workflowCode = readWorkflowSource("batch-processor/workflows/batch-processor.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "bulkhead": {
      const workflowCode = readWorkflowSource("bulkhead/workflows/bulkhead.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "cancellable-export": {
      const workflowCode = readWorkflowSource("cancellable-export/workflows/report-generator.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCodes: [],
        stepLinesHtml: [],
        highlightLineMap: {},
        sectionNames: [],
        sectionContent: [],
      };
    }
    case "choreography": {
      const workflowCode = readWorkflowSource("choreography/workflows/choreography.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        flowCode: workflowCode,
        flowHtmlLines: workflowHtmlLines,
        flowLineMap: {},
        participantCode: "",
        participantHtmlLines: [],
        participantLineMap: {},
      };
    }
    case "circuit-breaker":
      return getCircuitBreakerCodeProps();
    case "claim-check": {
      const workflowCode = readWorkflowSource("claim-check/workflows/claim-check.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "competing-consumers": {
      const workflowCode = readWorkflowSource("competing-consumers/workflows/competing-consumers.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "content-based-router": {
      const workflowCode = readWorkflowSource("content-based-router/workflows/content-based-router.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "content-enricher": {
      const workflowCode = readWorkflowSource("content-enricher/workflows/content-enricher.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "correlation-identifier": {
      const workflowCode = readWorkflowSource("correlation-identifier/workflows/correlation-identifier.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "dead-letter-queue":
      return getDeadLetterQueueCodeProps();
    case "detour": {
      const workflowCode = readWorkflowSource("detour/workflows/detour.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "event-gateway": {
      const workflowCode = readWorkflowSource("event-gateway/workflows/event-gateway.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "event-sourcing": {
      const workflowCode = readWorkflowSource("event-sourcing/workflows/event-sourcing.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        stepCode: "",
        stepHtmlLines: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "fan-out":
      return getFanOutCodeProps();
    case "guaranteed-delivery": {
      const workflowCode = readWorkflowSource("guaranteed-delivery/workflows/guaranteed-delivery.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "hedge-request": {
      const workflowCode = readWorkflowSource("hedge-request/workflows/hedge-request.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "idempotent-receiver":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "map-reduce": {
      const workflowCode = readWorkflowSource("map-reduce/workflows/map-reduce.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "message-filter": {
      const workflowCode = readWorkflowSource("message-filter/workflows/order-filter.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "message-history": {
      const workflowCode = readWorkflowSource("message-history/workflows/message-history.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        orchestratorCode: workflowCode,
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "message-translator": {
      const workflowCode = readWorkflowSource("message-translator/workflows/message-translator.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "namespaced-streams": {
      const workflowCode = readWorkflowSource("namespaced-streams/workflows/namespaced-streams.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "normalizer": {
      const workflowCode = readWorkflowSource("normalizer/workflows/normalizer.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "onboarding-drip": {
      const workflowCode = readWorkflowSource("onboarding-drip/workflows/onboarding-drip.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCodes: [],
        stepLinesHtml: [],
        stepSendLines: {},
        stepSleepLines: {},
      };
    }
    case "pipeline": {
      const workflowCode = readWorkflowSource("pipeline/workflows/pipeline.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
        workflowDirective: "",
        stepDirective: "",
      };
    }
    case "priority-queue": {
      const workflowCode = readWorkflowSource("priority-queue/workflows/priority-queue.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "process-manager": {
      const workflowCode = readWorkflowSource("process-manager/workflows/process-manager.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        orchestratorCode: workflowCode,
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "publish-subscribe": {
      const workflowCode = readWorkflowSource("publish-subscribe/workflows/publish-subscribe.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "recipient-list": {
      const workflowCode = readWorkflowSource("recipient-list/workflows/recipient-list.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepRetryLineMap: {},
        stepSuccessLineMap: {},
      };
    }
    case "request-reply": {
      const workflowCode = readWorkflowSource("request-reply/workflows/request-reply.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "resequencer": {
      const workflowCode = readWorkflowSource("resequencer/workflows/resequencer.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "retry-backoff": {
      const workflowCode = readWorkflowSource("retry-backoff/workflows/retry-backoff.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "retryable-rate-limit": {
      const workflowCode = readWorkflowSource("retryable-rate-limit/workflows/retryable-rate-limit.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "routing-slip": {
      const workflowCode = readWorkflowSource("routing-slip/workflows/routing-slip.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
      };
    }
    case "saga":
      return getSagaCodeProps();
    case "scatter-gather": {
      const workflowCode = readWorkflowSource("scatter-gather/workflows/scatter-gather.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepSuccessLineMap: {},
      };
    }
    case "scheduled-digest": {
      const workflowCode = readWorkflowSource("scheduled-digest/workflows/scheduled-digest.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "scheduler-agent-supervisor": {
      const workflowCode = readWorkflowSource("scheduler-agent-supervisor/workflows/scheduler-agent-supervisor.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "splitter":
      return getSplitterCodeProps();
    case "status-poller": {
      const workflowCode = readWorkflowSource("status-poller/workflows/status-poller.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "throttle": {
      const workflowCode = readWorkflowSource("throttle/workflows/throttle.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "transactional-outbox": {
      const workflowCode = readWorkflowSource("transactional-outbox/workflows/transactional-outbox.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "wakeable-reminder": {
      const workflowCode = readWorkflowSource("wakeable-reminder/workflows/wakeable-reminder.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: "",
        stepHtmlLines: [],
        stepLineMap: {},
      };
    }
    case "webhook-basics":
      return {
        orchestratorHtmlLines: [],
        orchestratorLineMap: {},
        stepHtmlLines: [],
        stepLineMap: {},
      };
    case "wire-tap": {
      const workflowCode = readWorkflowSource("wire-tap/workflows/wire-tap.ts");
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: "",
        stepLinesHtml: [],
        lineMap: {},
      };
    }
    default:
      return {};
  }
}
