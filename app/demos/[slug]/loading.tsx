export default function DemoDetailLoading() {
  return (
    <main className="min-h-screen bg-background-100 text-gray-1000">
      {/* Top bar skeleton */}
      <div className="border-b border-gray-300 bg-background-200/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="h-4 w-14 rounded bg-gray-300 skeleton-pulse" />
          <span className="text-gray-300">/</span>
          <div className="h-4 w-48 rounded bg-gray-300 skeleton-pulse" />
          <div className="ml-auto hidden sm:flex items-center gap-1.5">
            <div className="h-4 w-14 rounded-full bg-gray-300 skeleton-pulse" />
            <div className="h-4 w-18 rounded-full bg-gray-300 skeleton-pulse" />
            <div className="h-4 w-12 rounded-full bg-gray-300 skeleton-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Context strip skeleton */}
        <div className="flex flex-col gap-3 border-b border-gray-300/50 py-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-300 skeleton-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-300 skeleton-pulse" />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <div className="h-5 w-20 rounded border border-gray-300 bg-background-200 skeleton-pulse" />
            <div className="h-5 w-16 rounded border border-gray-300 bg-background-200 skeleton-pulse" />
          </div>
        </div>

        {/* Code workbench skeleton — hero area */}
        <div className="py-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left pane: demo UI */}
            <div className="rounded-lg border border-gray-300 bg-background-200 p-6">
              <div className="space-y-3">
                <div className="h-8 w-32 rounded bg-gray-300 skeleton-pulse" />
                <div className="h-4 w-full rounded bg-gray-300 skeleton-pulse" />
                <div className="h-4 w-5/6 rounded bg-gray-300 skeleton-pulse" />
                <div className="mt-6 h-10 w-28 rounded-md bg-gray-300 skeleton-pulse" />
              </div>
            </div>
            {/* Right pane: code */}
            <div className="rounded-lg border border-gray-300 bg-background-200 p-4">
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3.5 rounded bg-gray-300 skeleton-pulse"
                    style={{ width: `${40 + Math.sin(i * 1.7) * 30}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
