/**
 * Demo adapter registry.
 *
 * Central lookup for all mounted demo adapters. Unknown slugs return undefined
 * so callers can render a 404.
 */

import type { DemoAdapter } from "./types";
import { aggregatorAdapter } from "./aggregator";
import { approvalChainAdapter } from "./approval-chain";
import { approvalGateAdapter } from "./approval-gate";
import { asyncRequestReplyAdapter } from "./async-request-reply";
import { batchProcessorAdapter } from "./batch-processor";
import { bulkheadAdapter } from "./bulkhead";
import { cancellableExportAdapter } from "./cancellable-export";
import { choreographyAdapter } from "./choreography";
import { circuitBreakerAdapter } from "./circuit-breaker";
import { claimCheckAdapter } from "./claim-check";
import { competingConsumersAdapter } from "./competing-consumers";
import { contentBasedRouterAdapter } from "./content-based-router";
import { contentEnricherAdapter } from "./content-enricher";
import { correlationIdentifierAdapter } from "./correlation-identifier";
import { deadLetterQueueAdapter } from "./dead-letter-queue";
import { detourAdapter } from "./detour";
import { eventGatewayAdapter } from "./event-gateway";
import { eventSourcingAdapter } from "./event-sourcing";
import { fanOutAdapter } from "./fan-out";
import { guaranteedDeliveryAdapter } from "./guaranteed-delivery";
import { hedgeRequestAdapter } from "./hedge-request";
import { idempotentReceiverAdapter } from "./idempotent-receiver";
import { mapReduceAdapter } from "./map-reduce";
import { messageFilterAdapter } from "./message-filter";
import { messageHistoryAdapter } from "./message-history";
import { messageTranslatorAdapter } from "./message-translator";
import { namespacedStreamsAdapter } from "./namespaced-streams";
import { normalizerAdapter } from "./normalizer";
import { onboardingDripAdapter } from "./onboarding-drip";
import { pipelineAdapter } from "./pipeline";
import { priorityQueueAdapter } from "./priority-queue";
import { processManagerAdapter } from "./process-manager";
import { publishSubscribeAdapter } from "./publish-subscribe";
import { recipientListAdapter } from "./recipient-list";
import { requestReplyAdapter } from "./request-reply";
import { resequencerAdapter } from "./resequencer";
import { retryBackoffAdapter } from "./retry-backoff";
import { retryableRateLimitAdapter } from "./retryable-rate-limit";
import { routingSlipAdapter } from "./routing-slip";
import { sagaAdapter } from "./saga";
import { scatterGatherAdapter } from "./scatter-gather";
import { scheduledDigestAdapter } from "./scheduled-digest";
import { schedulerAgentSupervisorAdapter } from "./scheduler-agent-supervisor";
import { splitterAdapter } from "./splitter";
import { statusPollerAdapter } from "./status-poller";
import { throttleAdapter } from "./throttle";
import { transactionalOutboxAdapter } from "./transactional-outbox";
import { wakeableReminderAdapter } from "./wakeable-reminder";
import { webhookBasicsAdapter } from "./webhook-basics";
import { wireTapAdapter } from "./wire-tap";

const adapters: ReadonlyMap<string, DemoAdapter> = new Map([
  [aggregatorAdapter.slug, aggregatorAdapter],
  [fanOutAdapter.slug, fanOutAdapter],
  [approvalChainAdapter.slug, approvalChainAdapter],
  [approvalGateAdapter.slug, approvalGateAdapter],
  [asyncRequestReplyAdapter.slug, asyncRequestReplyAdapter],
  [batchProcessorAdapter.slug, batchProcessorAdapter],
  [bulkheadAdapter.slug, bulkheadAdapter],
  [cancellableExportAdapter.slug, cancellableExportAdapter],
  [choreographyAdapter.slug, choreographyAdapter],
  [circuitBreakerAdapter.slug, circuitBreakerAdapter],
  [claimCheckAdapter.slug, claimCheckAdapter],
  [competingConsumersAdapter.slug, competingConsumersAdapter],
  [contentBasedRouterAdapter.slug, contentBasedRouterAdapter],
  [contentEnricherAdapter.slug, contentEnricherAdapter],
  [correlationIdentifierAdapter.slug, correlationIdentifierAdapter],
  [deadLetterQueueAdapter.slug, deadLetterQueueAdapter],
  [detourAdapter.slug, detourAdapter],
  [eventGatewayAdapter.slug, eventGatewayAdapter],
  [eventSourcingAdapter.slug, eventSourcingAdapter],
  [guaranteedDeliveryAdapter.slug, guaranteedDeliveryAdapter],
  [hedgeRequestAdapter.slug, hedgeRequestAdapter],
  [idempotentReceiverAdapter.slug, idempotentReceiverAdapter],
  [mapReduceAdapter.slug, mapReduceAdapter],
  [messageFilterAdapter.slug, messageFilterAdapter],
  [messageHistoryAdapter.slug, messageHistoryAdapter],
  [messageTranslatorAdapter.slug, messageTranslatorAdapter],
  [namespacedStreamsAdapter.slug, namespacedStreamsAdapter],
  [normalizerAdapter.slug, normalizerAdapter],
  [onboardingDripAdapter.slug, onboardingDripAdapter],
  [pipelineAdapter.slug, pipelineAdapter],
  [priorityQueueAdapter.slug, priorityQueueAdapter],
  [processManagerAdapter.slug, processManagerAdapter],
  [publishSubscribeAdapter.slug, publishSubscribeAdapter],
  [recipientListAdapter.slug, recipientListAdapter],
  [requestReplyAdapter.slug, requestReplyAdapter],
  [resequencerAdapter.slug, resequencerAdapter],
  [retryBackoffAdapter.slug, retryBackoffAdapter],
  [retryableRateLimitAdapter.slug, retryableRateLimitAdapter],
  [routingSlipAdapter.slug, routingSlipAdapter],
  [sagaAdapter.slug, sagaAdapter],
  [scatterGatherAdapter.slug, scatterGatherAdapter],
  [scheduledDigestAdapter.slug, scheduledDigestAdapter],
  [schedulerAgentSupervisorAdapter.slug, schedulerAgentSupervisorAdapter],
  [splitterAdapter.slug, splitterAdapter],
  [statusPollerAdapter.slug, statusPollerAdapter],
  [throttleAdapter.slug, throttleAdapter],
  [transactionalOutboxAdapter.slug, transactionalOutboxAdapter],
  [wakeableReminderAdapter.slug, wakeableReminderAdapter],
  [webhookBasicsAdapter.slug, webhookBasicsAdapter],
  [wireTapAdapter.slug, wireTapAdapter],
]);

/** Resolve an adapter by slug. Returns undefined for unknown slugs. */
export function getAdapter(slug: string): DemoAdapter | undefined {
  return adapters.get(slug);
}

/** All registered adapter slugs. */
export function getRegisteredSlugs(): string[] {
  return [...adapters.keys()];
}

export type {
  DemoAdapter,
  DemoCodeFile,
  CodeFileRole,
  ApiRouteKind,
  DemoApiRoute,
  GalleryRouteContext,
  GalleryRouteHandler,
  GalleryRouteModule,
} from "./types";
