// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "scheduled-digest",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props",
    "hardcoded_extra_route:/api/event->/api/scheduled-digest/event"
  ],
  "routeMap": {
    "start": {
      "original": "/api/scheduled-digest",
      "gallery": "/api/scheduled-digest"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/event": "/api/scheduled-digest/event"
    }
  }
} as const;

export default function ScheduledDigestNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
