// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "transactional-outbox",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/transactional-outbox",
      "gallery": "/api/transactional-outbox"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/run/[runId]": "/api/transactional-outbox/run/[runId]"
    }
  }
} as const;

export default function TransactionalOutboxNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
