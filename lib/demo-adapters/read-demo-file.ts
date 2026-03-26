/**
 * Shared helper for reading files from demo directories.
 *
 * Centralizes the filesystem logic so individual adapters don't duplicate
 * path resolution. All reads are relative to `<cwd>/<slug>/...`.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Read a file from a demo directory.
 *
 * @param slug - Demo directory name (e.g. "fan-out")
 * @param relativePath - Path relative to the demo directory (e.g. "workflows/incident-fanout.ts")
 * @returns File contents as UTF-8 string
 * @throws If the file does not exist
 */
export function readDemoFile(slug: string, relativePath: string): string {
  const fullPath = join(process.cwd(), slug, relativePath);
  return readFileSync(fullPath, "utf-8");
}

/**
 * Check whether a file exists in a demo directory.
 *
 * @param slug - Demo directory name
 * @param relativePath - Path relative to the demo directory
 */
export function demoFileExists(slug: string, relativePath: string): boolean {
  const fullPath = join(process.cwd(), slug, relativePath);
  return existsSync(fullPath);
}
