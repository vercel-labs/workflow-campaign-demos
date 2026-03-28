import { notFound } from "next/navigation";
import { getDemo } from "@/lib/demos";
import { nativeDemos } from "@/lib/native-demos.generated";
import { DemoDetailShell } from "@/app/components/demos/demo-detail-shell";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  const native = nativeDemos[slug as keyof typeof nativeDemos];

  if (!demo || !native) {
    notFound();
  }

  console.log(
    JSON.stringify({
      level: "info",
      page: "demo-detail",
      action: "render",
      slug,
      uiReady: native.uiReady,
      workflowId: native.workflowId,
    })
  );

  if (!native.uiReady) {
    return (
      <DemoDetailShell
        slug={slug}
        title={demo.title}
        catalogEntry={demo}
        apiRoutes={native.apiRoutes}
      >
        <div className="rounded-lg border border-gray-300 bg-background-200 p-8 text-center text-sm text-gray-900">
          Native demo adapter pending for <code>{slug}</code>.
        </div>
      </DemoDetailShell>
    );
  }

  const { default: DemoComponent } = await native.component();

  return (
    <DemoDetailShell
      slug={slug}
      title={demo.title}
      catalogEntry={demo}
      apiRoutes={native.apiRoutes}
    >
      <DemoComponent />
    </DemoDetailShell>
  );
}
