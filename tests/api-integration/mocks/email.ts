import type { EmailResult } from "../../../packages/email/src/send-email";

export async function sendMagicLinkEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendOtpEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendWorkspaceInvitationEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export function isSmtpConfigured(): boolean {
  return false;
}

// The integration suite runs with no transport configured; the mock keeps
// that contract without touching turbo.json's env declarations.
export function isResendConfigured(): boolean {
  return false;
}

export function isEmailConfigured(): boolean {
  return isSmtpConfigured() || isResendConfigured();
}
