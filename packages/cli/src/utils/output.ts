export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printJson(data: unknown): void {
  console.log(formatJson(data));
}

export function printOperationResult(data: unknown): void {
  printJson(data);
  if (hasOperationErrors(data)) process.exitCode = 1;
}

export function hasOperationErrors(data: unknown): boolean {
  if (!data || typeof data !== "object" || !("errors" in data)) return false;
  return Array.isArray(data.errors) && data.errors.length > 0;
}

interface StdinLike extends AsyncIterable<Buffer | string> {
  isTTY?: boolean;
}

export async function readStdin(
  input: StdinLike = process.stdin,
  missingContentMessage = "Missing summary content. Pass --file or pipe Markdown to stdin.",
): Promise<string> {
  if (input.isTTY) {
    throw new Error(missingContentMessage);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
