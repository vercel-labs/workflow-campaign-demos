import { ScenarioMatcher } from "./components/gallery/scenario-matcher";

export default function GalleryPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen px-6 pt-24 pb-20 mx-auto max-w-6xl"
    >
      <header className="mb-16 text-center">
        <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-blue-700 mb-5">
          30 Days of Workflow DevKit
        </p>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-1000 leading-[1.05]">
          Pattern Gallery
        </h1>
        <p className="mt-5 text-base text-gray-900 max-w-lg mx-auto leading-relaxed">
          50 production workflow patterns — standalone Next.js apps
          with real-time execution visualization and code workbenches.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px] font-mono text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-700" />
            Interactive
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-700" />
            SSE Streaming
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-700" />
            Code Workbench
          </span>
        </div>
      </header>
      <ScenarioMatcher />
    </main>
  );
}
