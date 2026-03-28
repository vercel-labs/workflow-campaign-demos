// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { IdempotentReceiverDemo } from "@/idempotent-receiver/app/components/demo";

const demoProps = {
  orchestratorHtmlLines: [],
  orchestratorLineMap: {},
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof IdempotentReceiverDemo>[0];

export default function IdempotentReceiverNativeDemo() {
  return <IdempotentReceiverDemo {...demoProps} />;
}
