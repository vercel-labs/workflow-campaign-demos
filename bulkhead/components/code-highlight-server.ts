import { Prism, normalizeTokens } from "prism-react-renderer";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlightCodeToHtmlLines(code: string): string[] {
  const grammar = Prism.languages.typescript;
  if (!grammar) {
    return code.split("\n").map((line) => escapeHtml(line));
  }

  const tokens = Prism.tokenize(code, grammar);
  const normalized = normalizeTokens(tokens);

  return normalized.map((line) =>
    line
      .map((token) => {
        const className = token.types
          .filter((t) => t !== "plain")
          .map((t) => `token ${t}`)
          .join(" ");
        const content = escapeHtml(token.content);
        return className ? `<span class="${className}">${content}</span>` : content;
      })
      .join("")
  );
}
