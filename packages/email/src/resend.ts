// Resend (https://resend.com) transport: one HTTPS POST to their emails
// endpoint. Implemented with fetch instead of the official SDK - the API is a
// single JSON call, and the dependency would ride every Docker build for it.
// SMTP stays available; Resend wins when both are configured because an API
// key is an explicit choice and avoids relay deliverability issues.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;

type EmailEnv = Record<string, string | undefined>;

/** Sender header: RESEND_FROM, falling back to the SMTP sender. */
export function resendFrom(env: EmailEnv = process.env): string {
  return env.RESEND_FROM?.trim() || env.SMTP_FROM?.trim() || "";
}

export function isResendConfigured(env: EmailEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim()) && Boolean(resendFrom(env));
}

export type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type ResendSendResult = { id: string };

/**
 * Send one email through Resend. Throws on any failure; callers decide
 * whether that is fatal or logged (the send helpers keep their previous
 * fail-soft behavior for sign-in mail).
 */
export async function sendViaResend(
  { to, subject, html, text }: ResendSendInput,
  env: EmailEnv = process.env,
): Promise<ResendSendResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const from = resendFrom(env);
  if (!from) {
    throw new Error("RESEND_FROM (or SMTP_FROM) is not configured");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      // A text part improves deliverability for plain-text clients.
      ...(text ? { text } : {}),
    }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });

  const body = await response.text();
  if (!response.ok) {
    // Never echo the API key; the response body carries Resend's own error.
    throw new Error(
      `Resend request failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  let parsed: { id?: unknown } = {};
  try {
    parsed = JSON.parse(body) as { id?: unknown };
  } catch {
    parsed = {};
  }
  return { id: typeof parsed.id === "string" ? parsed.id : "" };
}
