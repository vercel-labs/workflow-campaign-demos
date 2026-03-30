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
import { getAsyncRequestReplyCodeProps } from "@/lib/generated/demo-code-props/async-request-reply";
import { getIdempotentReceiverCodeProps } from "@/lib/generated/demo-code-props/idempotent-receiver";
import { getChoreographyCodeProps } from "@/lib/generated/demo-code-props/choreography";
import { getCancellableExportCodeProps } from "@/lib/generated/demo-code-props/cancellable-export";
import { getOnboardingDripCodeProps } from "@/lib/generated/demo-code-props/onboarding-drip";
import { getPipelineCodeProps } from "@/lib/generated/demo-code-props/pipeline";
import { getRecipientListCodeProps } from "@/lib/generated/demo-code-props/recipient-list";
import { getRoutingSlipCodeProps } from "@/lib/generated/demo-code-props/routing-slip";
import { getScatterGatherCodeProps } from "@/lib/generated/demo-code-props/scatter-gather";
import { getWebhookBasicsCodeProps } from "@/lib/generated/demo-code-props/webhook-basics";
import { getWireTapCodeProps } from "@/lib/generated/demo-code-props/wire-tap";
import { getAggregatorCodeProps } from "@/lib/generated/demo-code-props/aggregator";
import { getApprovalChainCodeProps } from "@/lib/generated/demo-code-props/approval-chain";
import { getBatchProcessorCodeProps } from "@/lib/generated/demo-code-props/batch-processor";
import { getBulkheadCodeProps } from "@/lib/generated/demo-code-props/bulkhead";
import { getClaimCheckCodeProps } from "@/lib/generated/demo-code-props/claim-check";
import { getCompetingConsumersCodeProps } from "@/lib/generated/demo-code-props/competing-consumers";
import { getContentBasedRouterCodeProps } from "@/lib/generated/demo-code-props/content-based-router";
import { getContentEnricherCodeProps } from "@/lib/generated/demo-code-props/content-enricher";
import { getCorrelationIdentifierCodeProps } from "@/lib/generated/demo-code-props/correlation-identifier";
import { getDetourCodeProps } from "@/lib/generated/demo-code-props/detour";
import { getEventGatewayCodeProps } from "@/lib/generated/demo-code-props/event-gateway";
import { getEventSourcingCodeProps } from "@/lib/generated/demo-code-props/event-sourcing";
import { getGuaranteedDeliveryCodeProps } from "@/lib/generated/demo-code-props/guaranteed-delivery";
import { getHedgeRequestCodeProps } from "@/lib/generated/demo-code-props/hedge-request";
import { getMapReduceCodeProps } from "@/lib/generated/demo-code-props/map-reduce";
import { getMessageFilterCodeProps } from "@/lib/generated/demo-code-props/message-filter";
import { getMessageTranslatorCodeProps } from "@/lib/generated/demo-code-props/message-translator";
import { getNamespacedStreamsCodeProps } from "@/lib/generated/demo-code-props/namespaced-streams";
import { getNormalizerCodeProps } from "@/lib/generated/demo-code-props/normalizer";
import { getPriorityQueueCodeProps } from "@/lib/generated/demo-code-props/priority-queue";
import { getProcessManagerCodeProps } from "@/lib/generated/demo-code-props/process-manager";
import { getPublishSubscribeCodeProps } from "@/lib/generated/demo-code-props/publish-subscribe";
import { getRequestReplyCodeProps } from "@/lib/generated/demo-code-props/request-reply";
import { getResequencerCodeProps } from "@/lib/generated/demo-code-props/resequencer";
import { getRetryBackoffCodeProps } from "@/lib/generated/demo-code-props/retry-backoff";
import { getRetryableRateLimitCodeProps } from "@/lib/generated/demo-code-props/retryable-rate-limit";
import { getScheduledDigestCodeProps } from "@/lib/generated/demo-code-props/scheduled-digest";
import { getSchedulerAgentSupervisorCodeProps } from "@/lib/generated/demo-code-props/scheduler-agent-supervisor";
import { getStatusPollerCodeProps } from "@/lib/generated/demo-code-props/status-poller";
import { getThrottleCodeProps } from "@/lib/generated/demo-code-props/throttle";
import { getTransactionalOutboxCodeProps } from "@/lib/generated/demo-code-props/transactional-outbox";
import { getWakeableReminderCodeProps } from "@/lib/generated/demo-code-props/wakeable-reminder";

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
    case "aggregator":
      return getAggregatorCodeProps();
    case "approval-chain":
      return getApprovalChainCodeProps();
    case "approval-gate":
      return {};
    case "async-request-reply":
      return getAsyncRequestReplyCodeProps();
    case "batch-processor":
      return getBatchProcessorCodeProps();
    case "bulkhead":
      return getBulkheadCodeProps();
    case "cancellable-export":
      return getCancellableExportCodeProps();
    case "choreography":
      return getChoreographyCodeProps();
    case "circuit-breaker":
      return getCircuitBreakerCodeProps();
    case "claim-check":
      return getClaimCheckCodeProps();
    case "competing-consumers":
      return getCompetingConsumersCodeProps();
    case "content-based-router":
      return getContentBasedRouterCodeProps();
    case "content-enricher":
      return getContentEnricherCodeProps();
    case "correlation-identifier":
      return getCorrelationIdentifierCodeProps();
    case "dead-letter-queue":
      return getDeadLetterQueueCodeProps();
    case "detour":
      return getDetourCodeProps();
    case "event-gateway":
      return getEventGatewayCodeProps();
    case "event-sourcing":
      return getEventSourcingCodeProps();
    case "fan-out":
      return getFanOutCodeProps();
    case "guaranteed-delivery":
      return getGuaranteedDeliveryCodeProps();
    case "hedge-request":
      return getHedgeRequestCodeProps();
    case "idempotent-receiver":
      return getIdempotentReceiverCodeProps();
    case "map-reduce":
      return getMapReduceCodeProps();
    case "message-filter":
      return getMessageFilterCodeProps();
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
    case "message-translator":
      return getMessageTranslatorCodeProps();
    case "namespaced-streams":
      return getNamespacedStreamsCodeProps();
    case "normalizer":
      return getNormalizerCodeProps();
    case "onboarding-drip":
      return getOnboardingDripCodeProps();
    case "pipeline":
      return getPipelineCodeProps();
    case "priority-queue":
      return getPriorityQueueCodeProps();
    case "process-manager":
      return getProcessManagerCodeProps();
    case "publish-subscribe":
      return getPublishSubscribeCodeProps();
    case "recipient-list":
      return getRecipientListCodeProps();
    case "request-reply":
      return getRequestReplyCodeProps();
    case "resequencer":
      return getResequencerCodeProps();
    case "retry-backoff":
      return getRetryBackoffCodeProps();
    case "retryable-rate-limit":
      return getRetryableRateLimitCodeProps();
    case "routing-slip":
      return getRoutingSlipCodeProps();
    case "saga":
      return getSagaCodeProps();
    case "scatter-gather":
      return getScatterGatherCodeProps();
    case "scheduled-digest":
      return getScheduledDigestCodeProps();
    case "scheduler-agent-supervisor":
      return getSchedulerAgentSupervisorCodeProps();
    case "splitter":
      return getSplitterCodeProps();
    case "status-poller":
      return getStatusPollerCodeProps();
    case "throttle":
      return getThrottleCodeProps();
    case "transactional-outbox":
      return getTransactionalOutboxCodeProps();
    case "wakeable-reminder":
      return getWakeableReminderCodeProps();
    case "webhook-basics":
      return getWebhookBasicsCodeProps();
    case "wire-tap":
      return getWireTapCodeProps();
    default:
      return {};
  }
}
