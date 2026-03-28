// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { AsyncRequestReplyDemo } from "@/async-request-reply/app/components/demo";

const demoProps = {
  orchestratorHtmlLines: [],
  orchestratorLineMap: {},
  callbackHtmlLines: [],
  callbackLineMap: {},
} as unknown as Parameters<typeof AsyncRequestReplyDemo>[0];

export default function AsyncRequestReplyNativeDemo() {
  return <AsyncRequestReplyDemo {...demoProps} />;
}
