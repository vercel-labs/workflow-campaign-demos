// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { DLQDemo } from "@/dead-letter-queue/app/components/demo";

export type DeadLetterQueueNativeDemoProps = Parameters<typeof DLQDemo>[0];

export default function DeadLetterQueueNativeDemo(props: DeadLetterQueueNativeDemoProps) {
  return <DLQDemo {...props} />;
}
