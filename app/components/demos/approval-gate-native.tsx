// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "approval-gate",
  "uiStatus": "adapter-required",
  "uiReasons": [
    "hardcoded_extra_route:/api/approve->/api/approval-gate/approve"
  ],
  "routeMap": {
    "start": {
      "original": "/api/approval-gate",
      "gallery": "/api/approval-gate"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/approve": "/api/approval-gate/approve"
    }
  }
} as const;

export default function ApprovalGateNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
