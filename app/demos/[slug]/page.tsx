import { notFound } from "next/navigation";
import { getAdapter } from "@/lib/demo-adapters";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const adapter = getAdapter(slug);

  if (!adapter) {
    notFound();
  }

  return await adapter.renderPage();
}
