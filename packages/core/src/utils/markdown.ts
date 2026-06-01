export function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/`/g, "\\`");
}
