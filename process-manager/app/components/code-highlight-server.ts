import { highlight } from "sugar-high";

export function highlightCodeToHtmlLines(code: string): string[] {
  return highlight(code).split("\n");
}

export function findLineNumbers(code: string, marker: string): number[] {
  const lines = code.split("\n");
  const matches: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(marker)) {
      matches.push(index + 1);
    }
  }

  return matches;
}

export function findBlockLineNumbers(code: string, startMarker: string): number[] {
  const lines = code.split("\n");
  const startIndex = lines.findIndex((line) => line.includes(startMarker));

  if (startIndex < 0) {
    return [];
  }

  const blockLines: number[] = [];
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    blockLines.push(index + 1);

    for (const char of line) {
      if (char === "{") {
        depth += 1;
      }

      if (char === "}") {
        depth -= 1;
      }
    }

    if (index > startIndex && depth <= 0) {
      break;
    }
  }

  return blockLines;
}
