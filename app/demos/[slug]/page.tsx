import { notFound } from "next/navigation";
import { getDemo } from "@/lib/demos";
import { nativeDemos } from "@/lib/native-demos.generated";
import { getNativeDemoCodeProps } from "@/lib/native-demo-code.generated";
import { DemoDetailShell } from "@/app/components/demos/demo-detail-shell";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  const native = nativeDemos[slug];

  if (!demo || !native) {
    notFound();
  }

  if (native.uiStatus !== "native-ready") {
    console.log(
      JSON.stringify({
        level: "info",
        page: "demo-detail",
        action: "render",
        slug,
        uiStatus: native.uiStatus,
        uiReasons: native.uiReasons,
      }),
    );

    return (
      <DemoDetailShell
        slug={slug}
        title={demo.title}
        catalogEntry={demo}
        apiRoutes={native.apiRoutes}
      >
        <pre className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900">
          {JSON.stringify(
            {
              slug,
              uiStatus: native.uiStatus,
              uiReasons: native.uiReasons,
              routeMap: native.routeMap,
            },
            null,
            2,
          )}
        </pre>
      </DemoDetailShell>
    );
  }

  const [{ default: DemoComponent }, codeProps] = await Promise.all([
    native.component(),
    getNativeDemoCodeProps(slug),
  ]);

  console.log(
    JSON.stringify({
      level: "info",
      page: "demo-detail",
      action: "render",
      slug,
      uiStatus: native.uiStatus,
      uiReasons: native.uiReasons,
      workflowId: native.workflowId,
      codePropKeys: Object.keys(codeProps),
    }),
  );

  return (
    <DemoDetailShell
      slug={slug}
      title={demo.title}
      catalogEntry={demo}
      apiRoutes={native.apiRoutes}
    >
      <DemoComponent {...codeProps} />
    </DemoDetailShell>
  );
}
