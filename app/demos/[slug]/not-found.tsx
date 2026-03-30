export default function DemoNotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background-100 px-6 text-gray-1000"
    >
      <div className="text-center max-w-md">
        <p className="text-xs font-mono text-gray-500 mb-4">404</p>
        <h1 className="text-xl font-semibold tracking-tight">
          Pattern not found
        </h1>
        <p className="mt-2 text-sm text-gray-900">
          The workflow pattern you&apos;re looking for doesn&apos;t exist in the gallery.
        </p>
        <a
          href="/"
          className="mt-8 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          Browse all patterns
        </a>
      </div>
    </main>
  );
}
