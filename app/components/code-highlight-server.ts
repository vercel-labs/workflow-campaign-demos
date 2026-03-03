import { Prism, normalizeTokens } from "prism-react-renderer";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlightCodeToHtmlLines(code: string): string[] {
  const grammar = Prism.languages.typescript ?? Prism.languages.javascript;
  const tokens = Prism.tokenize(code, grammar);
  const normalized = normalizeTokens(tokens);

  return normalized.map((line) => {
    return line
      .map((token) => {
        const className = token.types
          .map((t) => `token ${t}`)
          .join(" ");
        return `<span class="${className}">${escapeHtml(token.content)}</span>`;
      })
      .join("");
  });
}
