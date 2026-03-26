import { notFound } from "next/navigation";
import { getAdapter } from "@/lib/demo-adapters";
import { getDemo } from "@/lib/demos";
import { DemoDetailShell } from "@/app/components/demos/demo-detail-shell";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const adapter = getAdapter(slug);

  if (!adapter) {
    notFound();
  }

  const catalogEntry = getDemo(slug);
  const demo = await adapter.renderDemo();

  return (
    <DemoDetailShell
      slug={slug}
      title={adapter.title}
      catalogEntry={catalogEntry}
      apiRoutes={adapter.apiRoutes}
    >
      {demo}
    </DemoDetailShell>
  );
}
