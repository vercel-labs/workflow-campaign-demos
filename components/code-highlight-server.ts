import { highlight } from "sugar-high";

export function highlightCodeToHtmlLines(code: string): string[] {
  const html = highlight(code);
  return html.split("\n").map((line) => (line.length === 0 ? "&nbsp;" : line));
}
