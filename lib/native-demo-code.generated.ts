// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportedWorkflowBlock,
  extractSecondaryFunctionBlocks,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";
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
      const workflowSource = readWorkflowSource("aggregator/workflows/aggregator.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "approval-chain": {
      const workflowSource = readWorkflowSource("approval-chain/workflows/approval-chain.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "approval-gate":
      return {};
    case "async-request-reply": {
      const workflowSource = readWorkflowSource("async-request-reply/workflows/async-request-reply.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        callbackHtmlLines: secondaryHtmlLines,
        callbackLineMap: {},
      };
    }
    case "batch-processor": {
      const workflowSource = readWorkflowSource("batch-processor/workflows/batch-processor.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "bulkhead": {
      const workflowSource = readWorkflowSource("bulkhead/workflows/bulkhead.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "cancellable-export": {
      const workflowSource = readWorkflowSource("cancellable-export/workflows/report-generator.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCodes: [],
        stepLinesHtml: secondaryHtmlLines,
        highlightLineMap: {},
        sectionNames: [],
        sectionContent: [],
      };
    }
    case "choreography": {
      const workflowSource = readWorkflowSource("choreography/workflows/choreography.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        flowCode: workflowCode,
        flowHtmlLines: workflowHtmlLines,
        flowLineMap: {},
        participantCode: secondaryCode,
        participantHtmlLines: secondaryHtmlLines,
        participantLineMap: {},
      };
    }
    case "circuit-breaker":
      return getCircuitBreakerCodeProps();
    case "claim-check": {
      const workflowSource = readWorkflowSource("claim-check/workflows/claim-check.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "competing-consumers": {
      const workflowSource = readWorkflowSource("competing-consumers/workflows/competing-consumers.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "content-based-router": {
      const workflowSource = readWorkflowSource("content-based-router/workflows/content-based-router.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "content-enricher": {
      const workflowSource = readWorkflowSource("content-enricher/workflows/content-enricher.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "correlation-identifier": {
      const workflowSource = readWorkflowSource("correlation-identifier/workflows/correlation-identifier.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "dead-letter-queue":
      return getDeadLetterQueueCodeProps();
    case "detour": {
      const workflowSource = readWorkflowSource("detour/workflows/detour.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "event-gateway": {
      const workflowSource = readWorkflowSource("event-gateway/workflows/event-gateway.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "event-sourcing": {
      const workflowSource = readWorkflowSource("event-sourcing/workflows/event-sourcing.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "fan-out":
      return getFanOutCodeProps();
    case "guaranteed-delivery": {
      const workflowSource = readWorkflowSource("guaranteed-delivery/workflows/guaranteed-delivery.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "hedge-request": {
      const workflowSource = readWorkflowSource("hedge-request/workflows/hedge-request.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "idempotent-receiver": {
      const workflowSource = readWorkflowSource("idempotent-receiver/workflows/idempotent-receiver.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "map-reduce": {
      const workflowSource = readWorkflowSource("map-reduce/workflows/map-reduce.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "message-filter": {
      const workflowSource = readWorkflowSource("message-filter/workflows/order-filter.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "message-history": {
      const workflowSource = readWorkflowSource("message-history/workflows/message-history.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        orchestratorCode: workflowCode,
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "message-translator": {
      const workflowSource = readWorkflowSource("message-translator/workflows/message-translator.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "namespaced-streams": {
      const workflowSource = readWorkflowSource("namespaced-streams/workflows/namespaced-streams.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "normalizer": {
      const workflowSource = readWorkflowSource("normalizer/workflows/normalizer.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "onboarding-drip": {
      const workflowSource = readWorkflowSource("onboarding-drip/workflows/onboarding-drip.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCodes: [],
        stepLinesHtml: secondaryHtmlLines,
        stepSendLines: {},
        stepSleepLines: {},
      };
    }
    case "pipeline": {
      const workflowSource = readWorkflowSource("pipeline/workflows/pipeline.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        lineMap: {},
        workflowDirective: "",
        stepDirective: "",
      };
    }
    case "priority-queue": {
      const workflowSource = readWorkflowSource("priority-queue/workflows/priority-queue.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "process-manager": {
      const workflowSource = readWorkflowSource("process-manager/workflows/process-manager.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        orchestratorCode: workflowCode,
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "publish-subscribe": {
      const workflowSource = readWorkflowSource("publish-subscribe/workflows/publish-subscribe.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "recipient-list": {
      const workflowSource = readWorkflowSource("recipient-list/workflows/recipient-list.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepRetryLineMap: {},
        stepSuccessLineMap: {},
      };
    }
    case "request-reply": {
      const workflowSource = readWorkflowSource("request-reply/workflows/request-reply.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "resequencer": {
      const workflowSource = readWorkflowSource("resequencer/workflows/resequencer.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "retry-backoff": {
      const workflowSource = readWorkflowSource("retry-backoff/workflows/retry-backoff.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "retryable-rate-limit": {
      const workflowSource = readWorkflowSource("retryable-rate-limit/workflows/retryable-rate-limit.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "routing-slip": {
      const workflowSource = readWorkflowSource("routing-slip/workflows/routing-slip.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        lineMap: {},
      };
    }
    case "saga":
      return getSagaCodeProps();
    case "scatter-gather": {
      const workflowSource = readWorkflowSource("scatter-gather/workflows/scatter-gather.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
        stepErrorLineMap: {},
        stepSuccessLineMap: {},
      };
    }
    case "scheduled-digest": {
      const workflowSource = readWorkflowSource("scheduled-digest/workflows/scheduled-digest.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "scheduler-agent-supervisor": {
      const workflowSource = readWorkflowSource("scheduler-agent-supervisor/workflows/scheduler-agent-supervisor.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "splitter":
      return getSplitterCodeProps();
    case "status-poller": {
      const workflowSource = readWorkflowSource("status-poller/workflows/status-poller.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "throttle": {
      const workflowSource = readWorkflowSource("throttle/workflows/throttle.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "transactional-outbox": {
      const workflowSource = readWorkflowSource("transactional-outbox/workflows/transactional-outbox.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        workflowLineMap: {},
        stepLineMap: {},
      };
    }
    case "wakeable-reminder": {
      const workflowSource = readWorkflowSource("wakeable-reminder/workflows/wakeable-reminder.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowHtmlLines: workflowHtmlLines,
        workflowLineMap: {},
        stepCode: secondaryCode,
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "webhook-basics": {
      const workflowSource = readWorkflowSource("webhook-basics/workflows/payment-webhook.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        orchestratorHtmlLines: workflowHtmlLines,
        orchestratorLineMap: {},
        stepHtmlLines: secondaryHtmlLines,
        stepLineMap: {},
      };
    }
    case "wire-tap": {
      const workflowSource = readWorkflowSource("wire-tap/workflows/wire-tap.ts");
      const workflowCode = extractExportedWorkflowBlock(workflowSource);
      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);
      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;
      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
      return {
        workflowCode: workflowCode,
        workflowLinesHtml: workflowHtmlLines,
        stepCode: secondaryCode,
        stepLinesHtml: secondaryHtmlLines,
        lineMap: {},
      };
    }
    default:
      return {};
  }
}
