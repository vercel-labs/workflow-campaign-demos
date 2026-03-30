import { ScenarioMatcher } from "./components/gallery/scenario-matcher";

export default function GalleryPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen px-6 py-20 mx-auto max-w-6xl"
    >
      <header className="mb-12 border-b border-gray-300 pb-12 text-center">
        <p className="text-xs font-mono tracking-widest uppercase text-blue-700 mb-4">
          30 Days of Workflow DevKit
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 leading-[1.1]">
          Pattern Gallery
        </h1>
        <p className="mt-4 text-base text-gray-900 max-w-xl mx-auto leading-relaxed">
          50 production workflow patterns — each one a standalone, runnable
          Next.js app with real-time execution visualization.
        </p>
      </header>
      <ScenarioMatcher />
    </main>
  );
}
