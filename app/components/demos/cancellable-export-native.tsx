// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "cancellable-export",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/cancellable-export",
      "gallery": "/api/cancellable-export"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/run/[runId]": "/api/cancellable-export/run/[runId]"
    }
  }
} as const;

export default function CancellableExportNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
