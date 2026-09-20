import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isResendConfigured, resendFrom, sendViaResend } from "./resend";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isResendConfigured", () => {
  it("requires both an API key and a sender", () => {
    expect(isResendConfigured({})).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "re_123" })).toBe(false);
    expect(isResendConfigured({ RESEND_FROM: "Kaneo <noreply@x.dev>" })).toBe(
      false,
    );
    expect(
      isResendConfigured({
        RESEND_API_KEY: "re_123",
        RESEND_FROM: "Kaneo <noreply@x.dev>",
      }),
    ).toBe(true);
  });

  it("falls back to SMTP_FROM for the sender", () => {
    expect(resendFrom({ SMTP_FROM: "kaneo@x.dev" })).toBe("kaneo@x.dev");
    expect(
      resendFrom({ RESEND_FROM: "Kaneo <a@x.dev>", SMTP_FROM: "b@x.dev" }),
    ).toBe("Kaneo <a@x.dev>");
  });
});

describe("sendViaResend", () => {
  it("posts the email and returns the id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );

    const result = await sendViaResend(
      {
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      { RESEND_API_KEY: "re_123", RESEND_FROM: "Kaneo <noreply@x.dev>" },
    );

    expect(result).toEqual({ id: "email-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer re_123",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Kaneo <noreply@x.dev>",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("throws with the status on an API error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "invalid key" }), { status: 401 }),
    );

    await expect(
      sendViaResend(
        { to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" },
        { RESEND_API_KEY: "re_bad", RESEND_FROM: "Kaneo <noreply@x.dev>" },
      ),
    ).rejects.toThrow("Resend request failed (401)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to call without an API key", async () => {
    await expect(
      sendViaResend(
        { to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" },
        { RESEND_FROM: "Kaneo <noreply@x.dev>" },
      ),
    ).rejects.toThrow("RESEND_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
