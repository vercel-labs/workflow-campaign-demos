import Link from "next/link";

export function StandaloneDemoFrame({
  title,
  src,
  backHref = "/",
}: {
  title: string;
  src: string;
  backHref?: string;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <div className="flex h-[49px] items-center justify-between border-b border-white/10 px-4">
        <Link
          href={backHref}
          className="text-sm text-white/70 transition-colors hover:text-white"
        >
          &larr; Gallery
        </Link>

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-white/70 transition-colors hover:text-white"
        >
          Open standalone
        </a>
      </div>

      <iframe
        title={title}
        src={src}
        className="block h-[calc(100vh-49px)] w-screen border-0 bg-black"
      />
    </main>
  );
}
