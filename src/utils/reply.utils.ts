export function formatReplyText(text: string | null | undefined): string | null {
  if (text == null || typeof text !== "string") return null;
  let out = text;

  out = out.replace(/\n\s*On .{10,200} wrote:\s*[\r\n>]?[\s\S]*/i, "");
  out = out.replace(/\n\s*On .{10,200} wrote:[\s\S]*$/i, "");
  out = out.replace(/\n?\s*Unsubscribe\s*\n?\s*<?https?:\/\/[^\s>\r\n]+>?\s*/gi, "");
  out = out.replace(/\n\s*Unsubscribe\s*\n?/gi, "\n");
  out = out.replace(/\n\s*Unsubscribe\s*$/im, "");
  out = out.replace(/\n\s*>[\s\S]*?$(?=\n|$)/gm, "");
  out = out.replace(/\n\s*>\s*/g, "\n");
  out = out.replace(/\n\s*-{3,}\s*Original Message\s*-{3,}[\s\S]*/i, "");
  out = out.replace(/\n\s*From:\s+.+\nSent:\s+.+\nTo:\s+[\s\S]*/i, "");
  out = out
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out || null;
}
