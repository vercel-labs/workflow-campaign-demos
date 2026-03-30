import { demos } from "@/lib/demos";
import { ScenarioMatcher } from "./components/gallery/scenario-matcher";

export default function GalleryPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-7xl"
    >
      <header className="mb-14 text-center">
        <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.2em] text-blue-700">
          30 Days of Workflow DevKit
        </p>
        <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight text-gray-1000 sm:text-6xl">
          Pattern Gallery
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-900">
          {demos.length} production workflow patterns with native demo UIs,
          real-time execution, and code workbenches that map directly to the
          underlying workflow source.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-gray-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-700" />
            {demos.length} patterns
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-700" />
            SSE streaming
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-700" />
            Static detail pages
          </span>
        </div>
      </header>
      <ScenarioMatcher />
    </main>
  );
}
