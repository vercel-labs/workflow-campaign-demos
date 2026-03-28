// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "onboarding-drip",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_export_missing",
    "component_requires_props"
  ],
  "routeMap": {
    "start": {
      "original": "/api/onboarding",
      "gallery": "/api/onboarding-drip"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/onboarding": "/api/onboarding-drip/onboarding"
    }
  }
} as const;

export default function OnboardingDripNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
