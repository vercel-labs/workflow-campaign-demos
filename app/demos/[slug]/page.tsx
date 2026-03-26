import { notFound } from "next/navigation";
import { getAdapter } from "@/lib/demo-adapters";
import { getDemo } from "@/lib/demos";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const adapter = getAdapter(slug);
  const catalogEntry = getDemo(slug);

  if (!adapter) {
    notFound();
  }

  const title = adapter.title;
  const description = catalogEntry?.description ?? "";
  const whenToUse = catalogEntry?.whenToUse ?? "";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <a
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          &larr; Gallery
        </a>
        <h1 className="text-2xl font-semibold mt-4 font-[family-name:var(--font-geist-sans)]">
          {title}
        </h1>
        {description && (
          <p className="text-neutral-400 mt-2 text-sm leading-relaxed">
            {description}
          </p>
        )}
        {whenToUse && (
          <p className="text-neutral-500 mt-1 text-xs">
            <span className="text-neutral-600">When to use:</span> {whenToUse}
          </p>
        )}
      </header>

      <section className="mb-8">
        <div className="flex gap-3 flex-wrap">
          {adapter.apiRoutes.map((r) => (
            <span
              key={r.route}
              className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 font-mono"
            >
              {r.kind}: {r.route}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-sm font-medium text-neutral-400 mb-3">
          Code Files
        </h2>
        <p className="text-xs text-neutral-500">
          Fetch code via{" "}
          <code className="text-cyan-400">
            GET /api/demos/{slug}/code
          </code>
        </p>
      </section>
    </main>
  );
}
