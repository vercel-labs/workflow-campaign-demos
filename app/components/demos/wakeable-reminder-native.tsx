// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "wakeable-reminder",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props",
    "hardcoded_extra_route:/api/wake->/api/wakeable-reminder/wake"
  ],
  "routeMap": {
    "start": {
      "original": "/api/wakeable-reminder",
      "gallery": "/api/wakeable-reminder"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/wake": "/api/wakeable-reminder/wake"
    }
  }
} as const;

export default function WakeableReminderNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
