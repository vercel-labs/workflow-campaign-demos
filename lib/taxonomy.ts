/**
 * Taxonomy definitions for demo categorization.
 *
 * Each tag in the generated catalog maps to a human-readable label
 * and a short description used in the filter UI.
 */

export type TaxonomyTag = {
  id: string;
  label: string;
  description: string;
};

export const taxonomy: TaxonomyTag[] = [
  {
    id: "async",
    label: "Async",
    description: "Asynchronous processing and callback patterns",
  },
  {
    id: "data-processing",
    label: "Data Processing",
    description: "Transform, batch, and aggregate data flows",
  },
  {
    id: "human-in-the-loop",
    label: "Human-in-the-Loop",
    description: "Approval gates, reviews, and manual interventions",
  },
  {
    id: "integration",
    label: "Integration",
    description: "Connect external systems, webhooks, and APIs",
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "Message routing, filtering, and transformation",
  },
  {
    id: "observability",
    label: "Observability",
    description: "Logging, tracing, and monitoring patterns",
  },
  {
    id: "orchestration",
    label: "Orchestration",
    description: "Coordinate multi-step and multi-service flows",
  },
  {
    id: "resilience",
    label: "Resilience",
    description: "Retry, circuit-break, and recover from failures",
  },
  {
    id: "routing",
    label: "Routing",
    description: "Direct messages to the right handler or destination",
  },
  {
    id: "scheduling",
    label: "Scheduling",
    description: "Time-based triggers, reminders, and cron patterns",
  },
];

/** Map from tag id to taxonomy entry for O(1) lookup. */
export const taxonomyMap = new Map(taxonomy.map((t) => [t.id, t]));

/** Get the display label for a tag, falling back to the raw id. */
export function getTagLabel(tagId: string): string {
  return taxonomyMap.get(tagId)?.label ?? tagId;
}
