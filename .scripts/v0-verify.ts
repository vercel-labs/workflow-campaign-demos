#!/usr/bin/env bun
/**
 * v0-verify — deterministic preview verifier for v0 chat imports.
 *
 * Usage:
 *   bun .scripts/v0-verify.ts --chat var8B3GtqgI
 *   bun .scripts/v0-verify.ts --url https://v0.app/chat/var8B3GtqgI --require-probe
 *   bun .scripts/v0-verify.ts --help
 *
 * Requires V0_API_KEY in .env.local (or environment).
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const PROJECT_ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type V0VersionStatus = "pending" | "completed" | "failed";

interface V0Version {
  id: string;
  status: V0VersionStatus;
  demoUrl?: string;
  screenshotUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  files?: unknown[];
}

interface V0Chat {
  id: string;
  webUrl: string;
  apiUrl: string;
  privacy: string;
  name?: string;
  latestVersion?: V0Version;
}

interface VerifyArgs {
  chatId: string;
  apiBaseUrl: string;
  outDir: string;
  timeoutMs: number;
  pollIntervalMs: number;
  probePath: string;
  requireProbe: boolean;
  maxHtmlBytes: number;
}

interface DemoFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  sha256?: string;
  errorMatches?: string[];
  bodySnippet?: string;
}

interface ProbeFetchResult {
  ok: boolean;
  status: number;
  url: string;
  json?: unknown;
  text?: string;
}

interface VerificationResult {
  ok: boolean;
  chatId: string;
  webUrl?: string;

  versionId?: string;
  versionStatus?: V0VersionStatus;

  demoUrl?: string;
  screenshotPath?: string;

  demoFetch?: DemoFetchResult;
  probeFetch?: ProbeFetchResult;

  notes: string[];

  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Logging (JSONL to stdout, human to stderr)
// ---------------------------------------------------------------------------

function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

// ---------------------------------------------------------------------------
// Env loading (matches project pattern: .env.local first, then process.env)
// ---------------------------------------------------------------------------

function getApiKey(): string {
  // Check process.env first (allows shell-level override)
  if (process.env.V0_API_KEY) return process.env.V0_API_KEY;

  // Fall back to .env.local
  const envPath = join(PROJECT_ROOT, ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    const match = content.match(/^V0_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  }

  console.error("V0_API_KEY not found in environment or .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): string {
  return [
    "v0-verify — deterministic v0 preview verifier",
    "",
    "Required (one of):",
    "  --chat <chatId>         v0 chat id (e.g. var8B3GtqgI)",
    "  --url  <chatWebUrl>     v0 chat url (e.g. https://v0.app/chat/var8B3GtqgI)",
    "",
    "Optional:",
    "  --out-dir <dir>         default: .reports/v0",
    "  --timeout-ms <ms>       default: 180000",
    "  --poll-ms <ms>          default: 2000",
    "  --probe-path <path>     default: /api/__v0__/probe",
    "  --require-probe         fail if probe endpoint is not reachable",
    "  --api-base-url <url>    default: https://api.v0.dev/v1",
    "  --max-html-bytes <n>    default: 400000",
    "",
    "Env:",
    "  V0_API_KEY (reads from .env.local or environment)",
  ].join("\n");
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function extractChatIdFromUrl(chatUrl: string): string {
  const u = new URL(chatUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  const chatIdx = parts.indexOf("chat");
  if (chatIdx === -1 || !parts[chatIdx + 1]) {
    throw new Error(`Could not extract chat id from url: ${chatUrl}`);
  }
  return parts[chatIdx + 1];
}

function parseArgs(argv: string[]): VerifyArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.error(usage());
    process.exit(0);
  }

  const apiBaseUrl = getFlagValue(argv, "--api-base-url") ?? "https://api.v0.dev/v1";
  const outDir = getFlagValue(argv, "--out-dir") ?? join(PROJECT_ROOT, ".reports", "v0");
  const timeoutMs = Number(getFlagValue(argv, "--timeout-ms") ?? "180000");
  const pollIntervalMs = Number(getFlagValue(argv, "--poll-ms") ?? "2000");
  const probePath = getFlagValue(argv, "--probe-path") ?? "/api/__v0__/probe";
  const requireProbe = hasFlag(argv, "--require-probe");
  const maxHtmlBytes = Number(getFlagValue(argv, "--max-html-bytes") ?? "400000");

  const chatIdArg = getFlagValue(argv, "--chat");
  const chatUrlArg = getFlagValue(argv, "--url");
  const chatId =
    chatIdArg ??
    (chatUrlArg ? extractChatIdFromUrl(chatUrlArg) : undefined);

  if (!chatId) {
    console.error(usage());
    throw new Error("Missing --chat or --url");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("--timeout-ms must be > 0");
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) throw new Error("--poll-ms must be > 0");
  if (!Number.isFinite(maxHtmlBytes) || maxHtmlBytes <= 0) throw new Error("--max-html-bytes must be > 0");

  return {
    chatId,
    apiBaseUrl,
    outDir,
    timeoutMs,
    pollIntervalMs,
    probePath,
    requireProbe,
    maxHtmlBytes,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}\n${text.slice(0, 1000)}`);
  }
  return JSON.parse(text) as T;
}

async function fetchBinary(url: string, apiKey: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}\n${text.slice(0, 1000)}`);
  }
  const contentType = res.headers.get("content-type");
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, contentType };
}

function guessImageExt(contentType: string | null): string {
  if (!contentType) return "png";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

// ---------------------------------------------------------------------------
// v0 API polling
// ---------------------------------------------------------------------------

async function waitForLatestVersionTerminal(
  apiBaseUrl: string,
  apiKey: string,
  chatId: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<{ chat: V0Chat; version: V0Version }> {
  const started = Date.now();
  let attempt = 0;

  while (true) {
    const chat = await fetchJson<V0Chat>(`${apiBaseUrl}/chats/${chatId}`, apiKey);
    const version = chat.latestVersion;
    if (!version) throw new Error(`Chat ${chatId} has no latestVersion`);

    log("v0.latestVersion.poll", {
      chatId,
      attempt,
      status: version.status,
      versionId: version.id,
    });

    if (version.status === "completed" || version.status === "failed") {
      return { chat, version };
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for latestVersion to complete (>${timeoutMs}ms)`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
    attempt++;
  }
}

// ---------------------------------------------------------------------------
// Demo + Probe fetch
// ---------------------------------------------------------------------------

async function fetchDemoHtml(demoUrl: string, maxBytes: number): Promise<DemoFetchResult> {
  const res = await fetch(demoUrl, { redirect: "follow" });
  const contentType = res.headers.get("content-type");
  const finalUrl = res.url || demoUrl;

  const bytes = new Uint8Array(await res.arrayBuffer());
  const clipped = bytes.slice(0, maxBytes);

  const sha256 = createHash("sha256").update(clipped).digest("hex");

  const text = new TextDecoder().decode(clipped);
  const patterns = [
    "Turbopack build failed",
    "inferred your workspace root",
    "We couldn't find the Next.js package",
    "next/package.json",
    "Application error",
    "Internal Server Error",
    "ReferenceError: GENERATING is not defined",
  ];

  const errorMatches = patterns.filter((p) => text.includes(p));

  return {
    ok: res.ok,
    status: res.status,
    finalUrl,
    contentType,
    sha256,
    errorMatches: errorMatches.length ? errorMatches : undefined,
    bodySnippet: text.slice(0, 500),
  };
}

async function fetchProbe(demoUrl: string, probePath: string): Promise<ProbeFetchResult> {
  const url = new URL(probePath, demoUrl).toString();
  const res = await fetch(url, { headers: { accept: "application/json" } });

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, url, json };
  }

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, url, text: text.slice(0, 1000) };
}

// ---------------------------------------------------------------------------
// Report files
// ---------------------------------------------------------------------------

function writeReportFiles(outDir: string, baseName: string, report: VerificationResult): { jsonPath: string; mdPath: string } {
  const jsonPath = join(outDir, `${baseName}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const mdPath = join(outDir, `${baseName}.md`);
  const md = [
    `# v0 Verify Report`,
    ``,
    `- ok: **${report.ok}**`,
    `- chatId: \`${report.chatId}\``,
    report.webUrl ? `- chatUrl: ${report.webUrl}` : null,
    report.versionId ? `- versionId: \`${report.versionId}\`` : null,
    report.versionStatus ? `- versionStatus: \`${report.versionStatus}\`` : null,
    report.demoUrl ? `- demoUrl: ${report.demoUrl}` : null,
    report.screenshotPath ? `- screenshot: \`${report.screenshotPath}\`` : null,
    ``,
    `## Demo fetch`,
    report.demoFetch
      ? "```json\n" + JSON.stringify(report.demoFetch, null, 2) + "\n```"
      : "_no demo fetch_",
    ``,
    `## Probe fetch`,
    report.probeFetch
      ? "```json\n" + JSON.stringify(report.probeFetch, null, 2) + "\n```"
      : "_no probe fetch_",
    ``,
    `## Notes`,
    report.notes.length ? report.notes.map((n) => `- ${n}`).join("\n") : "- (none)",
    ``,
  ]
    .filter((line) => line !== null)
    .join("\n");

  writeFileSync(mdPath, md, "utf8");
  return { jsonPath, mdPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const apiKey = getApiKey();
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outDir, { recursive: true });

  log("v0.verify.start", { chatId: args.chatId, apiBaseUrl: args.apiBaseUrl });

  const report: VerificationResult = {
    ok: false,
    chatId: args.chatId,
    notes: [],
    startedAt,
    finishedAt: "",
    durationMs: 0,
  };

  try {
    const { chat, version } = await waitForLatestVersionTerminal(
      args.apiBaseUrl,
      apiKey,
      args.chatId,
      args.timeoutMs,
      args.pollIntervalMs,
    );

    report.webUrl = chat.webUrl;
    report.versionId = version.id;
    report.versionStatus = version.status;
    report.demoUrl = version.demoUrl;

    // Screenshot capture
    if (version.screenshotUrl) {
      try {
        const { bytes, contentType } = await fetchBinary(version.screenshotUrl, apiKey);
        const ext = guessImageExt(contentType);
        const screenshotPath = join(args.outDir, `${args.chatId}-${version.id}.screenshot.${ext}`);
        writeFileSync(screenshotPath, bytes);
        report.screenshotPath = screenshotPath;
        log("v0.verify.screenshot.saved", { screenshotPath, bytes: bytes.length, contentType });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.notes.push(`Screenshot fetch failed: ${msg}`);
        log("v0.verify.screenshot.error", { error: msg });
      }
    } else {
      report.notes.push("No latestVersion.screenshotUrl present in chat response.");
    }

    // Demo URL fetch
    if (version.demoUrl) {
      report.demoFetch = await fetchDemoHtml(version.demoUrl, args.maxHtmlBytes);
      log("v0.verify.demo.fetched", {
        status: report.demoFetch.status,
        finalUrl: report.demoFetch.finalUrl,
        errorMatches: report.demoFetch.errorMatches ?? [],
      });
    } else {
      report.notes.push("No latestVersion.demoUrl present in chat response.");
    }

    // Probe endpoint fetch
    if (version.demoUrl) {
      try {
        report.probeFetch = await fetchProbe(version.demoUrl, args.probePath);
        log("v0.verify.probe.fetched", {
          ok: report.probeFetch.ok,
          status: report.probeFetch.status,
          url: report.probeFetch.url,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.notes.push(`Probe fetch failed: ${msg}`);
        log("v0.verify.probe.error", { error: msg });
      }
    }

    // Decide pass/fail
    const failReasons: string[] = [];

    if (version.status !== "completed") {
      failReasons.push(`latestVersion.status is ${version.status} (expected completed)`);
    }

    if (report.demoFetch) {
      if (!report.demoFetch.ok) failReasons.push(`demoUrl fetch failed (HTTP ${report.demoFetch.status})`);
      if (report.demoFetch.errorMatches?.length) {
        failReasons.push(`demoUrl body matched error strings: ${report.demoFetch.errorMatches.join(", ")}`);
      }
    } else {
      failReasons.push("demoUrl was not fetched (missing demoUrl?)");
    }

    if (args.requireProbe) {
      if (!report.probeFetch) {
        failReasons.push("probe fetch not attempted");
      } else if (!report.probeFetch.ok) {
        failReasons.push(`probe endpoint failed (HTTP ${report.probeFetch.status})`);
      } else if (typeof report.probeFetch.json === "object" && report.probeFetch.json) {
        const maybeOk = (report.probeFetch.json as Record<string, unknown>).ok;
        if (maybeOk !== true) failReasons.push("probe JSON did not include ok:true");
      } else {
        // Probe returned 200 but not JSON — likely SPA fallback serving HTML
        failReasons.push("probe endpoint returned non-JSON response (likely SPA fallback, not server-side API route)");
      }
    }

    report.ok = failReasons.length === 0;
    report.notes.push(...failReasons);

    const finishedAt = new Date().toISOString();
    report.finishedAt = finishedAt;
    report.durationMs = Date.now() - startMs;

    const baseName = `${args.chatId}-${report.versionId ?? "unknown"}`;
    const { jsonPath, mdPath } = writeReportFiles(args.outDir, baseName, report);

    log("v0.verify.done", { ok: report.ok, jsonPath, mdPath });

    // Human summary to stderr
    console.error(
      `v0-verify ${report.ok ? "PASS" : "FAIL"} chat=${report.chatId} version=${report.versionId} status=${report.versionStatus}\n` +
        `  report: ${jsonPath}\n` +
        (report.screenshotPath ? `  screenshot: ${report.screenshotPath}\n` : "") +
        (report.notes.length ? `  notes: ${report.notes.join(" | ")}\n` : ""),
    );

    process.exitCode = report.ok ? 0 : 1;
  } catch (err) {
    const finishedAt = new Date().toISOString();
    report.finishedAt = finishedAt;
    report.durationMs = Date.now() - startMs;
    report.ok = false;
    report.notes.push(err instanceof Error ? err.message : String(err));

    const baseName = `${args.chatId}-error`;
    writeReportFiles(args.outDir, baseName, report);

    log("v0.verify.error", { chatId: args.chatId, error: report.notes[report.notes.length - 1] });
    console.error(`v0-verify FAIL chat=${args.chatId}\n  error: ${report.notes.join(" | ")}\n`);
    process.exitCode = 1;
  }
}

await main();
