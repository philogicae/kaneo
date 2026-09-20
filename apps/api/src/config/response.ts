import { z } from "../openapi";

export const configSchema = z
  .object({
    disableRegistration: z.boolean(),
    disablePasswordRegistration: z.boolean(),
    disableEmailOtpSignIn: z.boolean(),
    disableWorkspaceCreation: z.boolean(),
    isDemoMode: z.boolean(),
    hasSmtp: z.boolean().openapi({
      description: "SMTP_HOST and SMTP_FROM are configured.",
    }),
    hasEmail: z.boolean().openapi({
      description:
        "Any email transport is configured: Resend (RESEND_API_KEY) or SMTP. Prefer this over hasSmtp to decide whether mail can be sent.",
    }),
    hasGithubSignIn: z.boolean(),
    hasGoogleSignIn: z.boolean(),
    hasDiscordSignIn: z.boolean(),
    hasCustomOAuth: z.boolean(),
    hasGuestAccess: z.boolean(),
    disableLoginForm: z.boolean(),
    customOAuthAutoLogin: z.boolean(),
    customOAuthLogoutUrl: z.string().nullable(),
  })
  .openapi("Config");
