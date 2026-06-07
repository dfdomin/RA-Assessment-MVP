const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "|", "%"];

export function cleanHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export function safeCellValue(text: string): string {
  const value = String(text ?? "");
  if (!value) return value;
  if (FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return `'${value}`;
  }
  return value;
}

export function ensureNoFormula(value: string): string {
  const stripped = value.trim();
  if (stripped && FORMULA_PREFIXES.includes(stripped[0])) {
    throw new Error(`Formula injection detected: ${stripped.slice(0, 20)}`);
  }
  return stripped;
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}
