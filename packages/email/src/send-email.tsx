import { render } from "@react-email/components";
import { config } from "dotenv-mono";
import * as nodemailer from "nodemailer";
import { isResendConfigured, sendViaResend } from "./resend";
import { getSmtpTransportOptions, isSmtpConfigured } from "./smtp-config";
import type { MagicLinkEmailProps } from "./templates/magic-link";
import MagicLinkEmail from "./templates/magic-link";
import NotificationEmail, {
  type NotificationEmailProps,
} from "./templates/notification";
import type { OtpEmailProps } from "./templates/otp";
import OtpEmail from "./templates/otp";
import PasswordResetEmail, {
  type PasswordResetEmailProps,
} from "./templates/password-reset";
import TrialReminderEmail, {
  type TrialReminderEmailProps,
} from "./templates/trial-reminder";
import WorkspaceInvitationEmail, {
  type WorkspaceInvitationEmailProps,
} from "./templates/workspace-invitation";

config();

const transporter = nodemailer.createTransport(getSmtpTransportOptions());

export type EmailResult = {
  success: boolean;
  reason?: "EMAIL_NOT_CONFIGURED";
};

/**
 * Whether any email transport can send: a Resend API key, or SMTP host plus
 * sender. This is what callers check before promising an email went out.
 */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

/**
 * One delivery path for every template: Resend when its API key is set,
 * otherwise SMTP. Keeping this in one place is what lets a deployment switch
 * transports without touching individual senders.
 */
async function deliver({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (isResendConfigured()) {
    await sendViaResend({ to, subject, html });
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export const sendMagicLinkEmail = async (
  to: string,
  subject: string,
  data: MagicLinkEmailProps,
) => {
  const emailTemplate = await render(MagicLinkEmail(data));
  try {
    await deliver({ to, subject, html: emailTemplate });
  } catch (error) {
    console.error("Error sending magic link email", error);
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: string,
  data: OtpEmailProps,
) => {
  const emailTemplate = await render(OtpEmail(data));
  try {
    await deliver({ to, subject, html: emailTemplate });
  } catch (error) {
    console.error("Error sending OTP email", error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  subject: string,
  data: PasswordResetEmailProps,
) => {
  const emailTemplate = await render(PasswordResetEmail(data));
  try {
    await deliver({ to, subject, html: emailTemplate });
  } catch (error) {
    console.error("Error sending password reset email", error);
  }
};

export const sendWorkspaceInvitationEmail = async (
  to: string,
  subject: string,
  data: WorkspaceInvitationEmailProps,
): Promise<EmailResult> => {
  if (!isEmailConfigured()) {
    return { success: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(
      WorkspaceInvitationEmail({ ...data, to }),
    );
    await deliver({ to, subject, html: emailTemplate });
    return { success: true };
  } catch (error) {
    console.error("Error sending workspace invitation email", error);
    throw error;
  }
};

export const sendNotificationEmail = async (
  to: string,
  subject: string,
  data: NotificationEmailProps,
): Promise<EmailResult> => {
  if (!isEmailConfigured()) {
    return { success: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    const emailTemplate = await render(NotificationEmail(data));
    await deliver({ to, subject, html: emailTemplate });
    return { success: true };
  } catch (error) {
    console.error("Error sending notification email", error);
    throw error;
  }
};

export const sendTrialReminderEmail = async (
  to: string,
  subject: string,
  data: TrialReminderEmailProps,
) => {
  const emailTemplate = await render(TrialReminderEmail(data));
  try {
    await deliver({ to, subject, html: emailTemplate });
  } catch (error) {
    console.error("Error sending trial reminder email", error);
  }
};
