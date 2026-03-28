// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { PaymentWebhookDemo } from "@/webhook-basics/app/components/demo";

const demoProps = {
  orchestratorHtmlLines: [],
  orchestratorLineMap: {},
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof PaymentWebhookDemo>[0];

export default function WebhookBasicsNativeDemo() {
  return <PaymentWebhookDemo {...demoProps} />;
}
