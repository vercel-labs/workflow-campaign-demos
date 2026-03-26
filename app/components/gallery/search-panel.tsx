"use client";

export function SearchPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (query: string) => void;
}) {
  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor="gallery-search" className="sr-only">
        Search demos
      </label>
      <input
        id="gallery-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe a scenario or search by pattern name..."
        className="w-full rounded-lg border border-gray-300 bg-background-200 px-4 py-3 pl-10 text-sm text-gray-1000 placeholder:text-gray-500 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
    </div>
  );
}
