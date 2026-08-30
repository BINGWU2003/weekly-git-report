import type { UpdateInfo } from "electron-updater";

export function normalizeReleaseNotes(notes: UpdateInfo["releaseNotes"]): string | undefined {
  if (typeof notes === "string") return normalizeReleaseNoteBody(notes);
  if (!Array.isArray(notes)) return undefined;

  const content = notes
    .map((note) => {
      const body = normalizeReleaseNoteBody(note.note ?? "");
      return [`## ${note.version}`, body].filter(Boolean).join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
  return content || undefined;
}

function normalizeReleaseNoteBody(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  if (!/<\/?[a-z][^>]*>/i.test(trimmed)) return trimmed;

  const markdown = trimmed
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])\b[^>]*>/gi, (_, level: string) => `${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|blockquote|pre|ul|ol|table|tr)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos|nbsp);/gi, decodeHtmlEntity)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return markdown || undefined;
}

function decodeHtmlEntity(entity: string, value: string): string {
  if (value[0] === "#") {
    const hexadecimal = value[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(value.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
  }

  return (
    {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: '"',
    }[value.toLowerCase()] ?? entity
  );
}
