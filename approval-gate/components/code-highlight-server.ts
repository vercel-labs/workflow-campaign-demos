import { highlight } from "sugar-high";

export function highlightCodeToHtmlLines(code: string): string[] {
  return highlight(code).split("\n");
}
