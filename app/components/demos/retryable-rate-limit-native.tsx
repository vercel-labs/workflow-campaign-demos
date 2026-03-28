// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "retryable-rate-limit",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props",
    "hardcoded_start_route:/api/start->/api/retryable-rate-limit"
  ],
  "routeMap": {
    "start": {
      "original": "/api/start",
      "gallery": "/api/retryable-rate-limit"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/start": "/api/retryable-rate-limit/start"
    }
  }
} as const;

export default function RetryableRateLimitNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
