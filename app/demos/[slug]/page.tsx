import { notFound } from "next/navigation";
import { getDemo } from "@/lib/demos";
import { nativeDemos } from "@/lib/native-demos.generated";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  const native = nativeDemos[slug as keyof typeof nativeDemos];

  if (!demo || !native || !native.uiReady) {
    notFound();
  }

  const { default: DemoComponent } = await native.component();

  console.log(
    JSON.stringify({
      level: "info",
      page: "demo-detail",
      action: "render_native",
      slug,
      workflowId: native.workflowId,
    })
  );

  return <DemoComponent />;
}
