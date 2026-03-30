"use client";

import { useEffect } from "react";

export default function DemoDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        page: "demo-detail",
        level: "error",
        errorName: error.name,
        errorMessage: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background-100 px-6 text-gray-1000"
    >
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-red-700/30 bg-red-700/10">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-700"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-900">
          {error.message || "An unexpected error occurred while loading this demo."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-500 hover:text-gray-1000"
          >
            Back to gallery
          </a>
        </div>
      </div>
    </main>
  );
}
