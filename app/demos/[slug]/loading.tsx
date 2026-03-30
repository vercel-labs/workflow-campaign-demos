export default function DemoDetailLoading() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-background-100 px-6 py-10 text-gray-1000"
    >
      <div className="mx-auto max-w-6xl">
        {/* Back nav skeleton */}
        <nav className="mb-8">
          <div className="h-4 w-16 rounded bg-gray-300 skeleton-pulse" />
        </nav>

        {/* Header skeleton */}
        <header className="mb-8 border-b border-gray-300 pb-8">
          <div className="h-7 w-48 rounded bg-gray-300 skeleton-pulse" />
          <div className="mt-3 h-4 w-[28rem] max-w-full rounded bg-gray-300 skeleton-pulse" />
          <div className="mt-4 flex gap-2">
            <div className="h-5 w-16 rounded-full bg-gray-300 skeleton-pulse" />
            <div className="h-5 w-20 rounded-full bg-gray-300 skeleton-pulse" />
            <div className="h-5 w-14 rounded-full bg-gray-300 skeleton-pulse" />
          </div>
        </header>

        {/* Code workbench skeleton */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 rounded-lg border border-gray-300 bg-background-200 skeleton-pulse" />
          <div className="h-80 rounded-lg border border-gray-300 bg-background-200 skeleton-pulse" />
        </div>
      </div>
    </main>
  );
}
