/** Normalize common encoding/control/whitespace artifacts without flattening structure. */
export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface LimitedText {
  text: string;
  truncated: boolean;
}

/** Cap string length without leaving an unmatched UTF-16 high surrogate. */
export function limitExtractedText(text: string, maximumCharacters: number): LimitedText {
  if (text.length <= maximumCharacters) return { text, truncated: false };

  let end = maximumCharacters;
  const lastCodeUnit = text.charCodeAt(end - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
  return { text: text.slice(0, end), truncated: true };
}
