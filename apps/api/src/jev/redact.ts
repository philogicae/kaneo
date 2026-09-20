// Secret-shaped text redaction for everything sent to Jev.
//
// Task titles, descriptions, comments and search candidates routinely carry
// credentials people pasted into a board (tokens in URLs, bearer headers,
// key=value pairs). Jev is a third-party API, so the payload is stripped
// before it leaves the machine; the patterns mirror the reference
// implementation's shared redaction (bearer/basic tokens, key/token/secret/
// password assignments, long token-shaped blobs, hex digests, e-mails and
// query strings). Quantifiers are bounded so a 100k-char word cannot trigger
// quadratic backtracking.

export const REDACTED = "[redacted]";

const PATTERNS: Array<[RegExp, string]> = [
  [/\b(bearer|basic)\s+[^\s"']+/gi, `$1 ${REDACTED}`],
  [
    /(--?[\w-]{0,64}(?:key|token|secret|password|pwd)[\w-]{0,64})[= ]+"?[^\s",}]+/gi,
    `$1 ${REDACTED}`,
  ],
  [
    /([\w.-]{0,64}(?:key|token|secret|password|pwd)[\w.-]{0,64})\s*[=:]\s*"?[^\s",}]+/gi,
    `$1=${REDACTED}`,
  ],
  [/\b[A-Za-z0-9_-]{40,}\b/g, REDACTED],
  [/\b[0-9a-f]{32,}\b/gi, REDACTED],
  [/\b[\w.+-]{1,64}@[\w-]{1,255}\.[\w.]{1,255}\b/g, REDACTED],
  [/([?&])[^\s"'`]+/g, `$1${REDACTED}`],
];

/** Replace secret-shaped substrings with [redacted]. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** How many placeholders the text carries (for a mostly-redacted rule). */
export function redactionCount(text: string): number {
  let count = 0;
  let index = text.indexOf(REDACTED);
  while (index !== -1) {
    count++;
    index = text.indexOf(REDACTED, index + REDACTED.length);
  }
  return count;
}
