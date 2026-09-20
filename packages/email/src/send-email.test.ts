import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEmailConfigured, sendWorkspaceInvitationEmail } from "./send-email";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const invitationProps = {
  inviterEmail: "owner@example.com",
  inviterName: "Owner",
  workspaceName: "Workspace",
  invitationLink: "https://kaneo.example/invitation/accept/1",
  to: "invitee@example.com",
  copy: {
    subject: "Join {{workspaceName}}",
    preview: "{{inviterName}} invited you",
    title: "Join {{workspaceName}}",
    subtitle: "{{inviterName}} ({{inviterEmail}}) invited you.",
    cta: "Accept invitation",
    sameEmail: "You can accept with the same email.",
    ignore: "Ignore this email if you did not expect it.",
    footer: "Kaneo workspace invitation",
  },
};

describe("isEmailConfigured", () => {
  it("accepts a Resend key without SMTP", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("RESEND_FROM", "Kaneo <noreply@x.dev>");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");

    expect(isEmailConfigured()).toBe(true);
  });

  it("accepts SMTP without Resend", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_FROM", "kaneo@example.com");

    expect(isEmailConfigured()).toBe(true);
  });

  it("is false with neither transport", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");

    expect(isEmailConfigured()).toBe(false);
  });
});

describe("sendWorkspaceInvitationEmail through Resend", () => {
  it("sends over the Resend API when the key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("RESEND_FROM", "Kaneo <noreply@x.dev>");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );

    const result = await sendWorkspaceInvitationEmail(
      "invitee@example.com",
      "Join Workspace",
      invitationProps,
    );

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
    };
    expect(body.to).toEqual(["invitee@example.com"]);
    expect(body.subject).toBe("Join Workspace");
    expect(body.html).toContain("Accept");
  });

  it("reports the missing transport instead of throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");

    const result = await sendWorkspaceInvitationEmail(
      "invitee@example.com",
      "Join Workspace",
      invitationProps,
    );

    expect(result).toEqual({
      success: false,
      reason: "EMAIL_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
