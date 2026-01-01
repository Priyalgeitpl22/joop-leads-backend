export function parseBounceEmail(raw: string) {
    const emailMatch = raw.match(
      /Your message wasn't delivered to\s+([^\s<]+)/i
    );
  
    const dnsMatch = raw.match(/DNS Error:(.*)/i);
  
    return {
      type: "HARD_BOUNCE",
      reason: "DOMAIN_NOT_FOUND",
      recipient: emailMatch?.[1] || null,
      message:
        "The recipient domain does not exist (DNS MX lookup failed).",
      rawError: dnsMatch?.[1]?.trim() || null,
    };
  };