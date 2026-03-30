export default function DemoNotFound() {
  return (
    <main className="min-h-screen bg-background-100 text-gray-1000">
      {/* Top bar */}
      <div className="border-b border-gray-300 bg-background-200/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 shrink-0 text-xs font-mono text-gray-500 transition-colors hover:text-gray-1000"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Gallery
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-500">Not found</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <div className="mx-auto max-w-md">
          <p className="font-mono text-xs text-amber-700">404</p>
          <h1 className="mt-3 text-xl font-semibold">Demo not found</h1>
          <p className="mt-2 text-sm text-gray-900">
            This workflow pattern doesn&apos;t exist in the gallery. It may have
            been renamed or removed.
          </p>
          <a
            href="/"
            className="mt-8 inline-block rounded-md bg-blue-700 px-4 py-2 text-xs font-mono text-white transition-opacity hover:opacity-90"
          >
            Browse all demos
          </a>
        </div>
      </div>
    </main>
  );
}
