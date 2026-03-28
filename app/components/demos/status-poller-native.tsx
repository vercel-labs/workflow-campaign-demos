// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "status-poller",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/status-poller",
      "gallery": "/api/status-poller"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {}
  }
} as const;

export default function StatusPollerNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
