// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "claim-check",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/claim-check",
      "gallery": "/api/claim-check"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/claim-check/upload": "/api/claim-check/upload"
    }
  }
} as const;

export default function ClaimCheckNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
