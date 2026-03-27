import { notFound } from "next/navigation";
import { getDemo } from "@/lib/demos";
import { getDemoOrigin } from "@/lib/demo-runtime";
import { StandaloneDemoFrame } from "@/app/components/demos/standalone-demo-frame";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  const origin = getDemoOrigin(slug);

  if (!demo || !origin) {
    notFound();
  }

  return <StandaloneDemoFrame title={demo.title} src={origin} />;
}
