/**
 * Shared helper for reading files from demo directories.
 *
 * Centralizes the filesystem logic so individual adapters don't duplicate
 * path resolution. All reads are relative to `<cwd>/<slug>/...`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logAdapterEvent } from "./adapter-log";

export class DemoFileReadError extends Error {
  constructor(
    public readonly slug: string,
    public readonly relativePath: string,
    public readonly fullPath: string,
  ) {
    super(
      `Demo file missing for "${slug}": expected "${relativePath}" at "${fullPath}". ` +
        `Verify the adapter file list and keep demo directories unchanged.`,
    );
    this.name = "DemoFileReadError";
  }
}

/**
 * Read a file from a demo directory.
 *
 * @param slug - Demo directory name (e.g. "fan-out")
 * @param relativePath - Path relative to the demo directory
 * @returns File contents as UTF-8 string
 * @throws DemoFileReadError if the file does not exist
 */
export function readDemoFile(slug: string, relativePath: string): string {
  const fullPath = join(process.cwd(), slug, relativePath);

  if (!existsSync(fullPath)) {
    const error = new DemoFileReadError(slug, relativePath, fullPath);

    logAdapterEvent({
      level: "error",
      scope: "adapter",
      adapter: slug,
      action: "read_demo_file_failed",
      relativePath,
      fullPath,
      message: error.message,
    });

    throw error;
  }

  const contents = readFileSync(fullPath, "utf-8");

  logAdapterEvent({
    level: "info",
    scope: "adapter",
    adapter: slug,
    action: "read_demo_file_succeeded",
    relativePath,
    bytes: Buffer.byteLength(contents, "utf8"),
  });

  return contents;
}

export function demoFileExists(slug: string, relativePath: string): boolean {
  const fullPath = join(process.cwd(), slug, relativePath);
  return existsSync(fullPath);
}
