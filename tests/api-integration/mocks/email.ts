import type { EmailResult } from "../../../packages/email/src/send-email";

export { OTP_EXPIRY_SECONDS } from "../../../packages/email/src/otp-expiry";

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

// Password recovery goes through the same package, so the mock has to answer
// for it too or the reset flow never delivers a link.
export async function sendPasswordResetEmail(
  _to: string,
  _subject: string,
  _data: unknown,
): Promise<void> {
  return undefined;
}
