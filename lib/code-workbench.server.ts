/**
 * Shared server-side helpers for code highlighting and source extraction.
 * Used by gallery code-prop generation to produce highlighted HTML lines
 * and line-number maps that match standalone demo parity.
 */

import { Prism, normalizeTokens } from "prism-react-renderer";

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

/**
 * Highlights TypeScript/JavaScript code into an array of HTML strings,
 * one per source line.  Matches the output of each standalone demo's
 * `code-highlight-server.ts` (Prism engine).
 */
export function highlightCodeToHtmlLines(code: string): string[] {
  const grammar = Prism.languages.typescript ?? Prism.languages.javascript;
  const tokens = Prism.tokenize(code, grammar);
  const normalized = normalizeTokens(tokens);

  return normalized.map((line) =>
    line
      .map((token) => {
        const className = token.types.map((t) => `token ${t}`).join(" ");
        return `<span class="${className}">${escapeHtml(token.content)}</span>`;
      })
      .join(""),
  );
}

// ---------------------------------------------------------------------------
// Source extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a function block from source code starting at the line that
 * contains `marker`, tracking brace depth until the block closes.
 * Returns the full text of the function (including the marker line).
 */
export function extractFunctionBlock(source: string, marker: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return "";

  const output: string[] = [];
  let depth = 0;
  let sawBrace = false;

  for (let i = start; i < lines.length; i += 1) {
    output.push(lines[i]);
    const opens = (lines[i].match(/{/g) ?? []).length;
    const closes = (lines[i].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }

  return output.join("\n");
}

// ---------------------------------------------------------------------------
// Top-level function block splitting
// ---------------------------------------------------------------------------

const TOP_LEVEL_FUNCTION_RE =
  /^(export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/;

/**
 * Splits source code into an array of top-level function blocks.
 * Each block is the full text of one `function` declaration (including
 * `export` / `async` prefixes), delimited by brace-depth tracking.
 */
export function extractTopLevelFunctionBlocks(source: string): string[] {
  const lines = source.split("\n");
  const blocks: string[] = [];
  let topLevelDepth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const isFunctionStart =
      topLevelDepth === 0 && TOP_LEVEL_FUNCTION_RE.test(trimmed);

    if (isFunctionStart) {
      const output: string[] = [];
      let blockDepth = 0;
      let sawBrace = false;

      for (let j = i; j < lines.length; j += 1) {
        const blockLine = lines[j];
        output.push(blockLine);

        const opens = (blockLine.match(/{/g) ?? []).length;
        const closes = (blockLine.match(/}/g) ?? []).length;
        blockDepth += opens - closes;
        if (opens > 0) sawBrace = true;
        if (sawBrace && blockDepth === 0) {
          i = j;
          break;
        }
      }

      blocks.push(output.join("\n"));
      continue;
    }

    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    topLevelDepth += opens - closes;
  }

  return blocks;
}

/**
 * Returns the first exported top-level function block from the source.
 * Falls back to the entire source if no exported function is found.
 */
export function extractExportedWorkflowBlock(source: string): string {
  const blocks = extractTopLevelFunctionBlocks(source);
  return (
    blocks.find((block) => block.split("\n")[0]?.includes("export ")) ?? source
  );
}

/**
 * Returns all non-exported top-level function blocks joined by a blank line.
 * Returns `""` when no secondary (non-exported) blocks exist.
 */
export function extractSecondaryFunctionBlocks(source: string): string {
  return extractTopLevelFunctionBlocks(source)
    .filter((block) => !block.split("\n")[0]?.includes("export "))
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Line-number collection primitives
// ---------------------------------------------------------------------------

/**
 * Like `extractFunctionBlock` but returns 1-based line numbers instead
 * of the text content.
 */
export function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    output.push(index + 1);

    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawOpeningBrace = true;
    if (sawOpeningBrace && depth === 0) break;
  }

  return output;
}

/**
 * Collects 1-based line numbers starting at `marker` and ending when
 * `isTerminalLine` returns true (inclusive).
 */
export function collectUntil(
  lines: string[],
  marker: string,
  isTerminalLine: (line: string) => boolean,
): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    if (isTerminalLine(lines[index])) break;
  }

  return output;
}

/**
 * Returns 1-based line numbers of every line containing `marker`.
 */
export function findLineNumbers(code: string, marker: string): number[] {
  return code
    .split("\n")
    .map((line, index) => (line.includes(marker) ? index + 1 : null))
    .filter((line): line is number => line !== null);
}

/**
 * Returns 1-based line numbers of a brace-delimited block starting at
 * the first line containing `startMarker`.
 */
export function findBlockLineNumbers(code: string, startMarker: string): number[] {
  const lines = code.split("\n");
  const startIndex = lines.findIndex((line) => line.includes(startMarker));
  if (startIndex < 0) return [];

  const blockLines: number[] = [];
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    blockLines.push(index + 1);
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
    }
    if (index > startIndex && depth <= 0) break;
  }

  return blockLines;
}
