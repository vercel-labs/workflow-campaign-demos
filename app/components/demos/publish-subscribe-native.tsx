// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "publish-subscribe",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/publish-subscribe",
      "gallery": "/api/publish-subscribe"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {}
  }
} as const;

export default function PublishSubscribeNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
