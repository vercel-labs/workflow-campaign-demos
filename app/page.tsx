import { ScenarioMatcher } from "./components/gallery/scenario-matcher";

export default function GalleryPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen px-6 py-16 mx-auto max-w-6xl"
    >
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-1000">
          Workflow DevKit Gallery
        </h1>
        <p className="mt-3 text-lg text-gray-900 max-w-2xl mx-auto">
          50 workflow pattern demos — describe a scenario or browse by category
          to find the right pattern.
        </p>
      </header>
      <ScenarioMatcher />
    </main>
  );
}
