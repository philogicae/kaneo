import { describe, expect, it } from "vitest";
import {
  REDACTED,
  redactionCount,
  redactSecrets,
} from "../../../apps/api/src/jev/redact";

describe("redactSecrets", () => {
  it("strips bearer and basic credentials", () => {
    expect(redactSecrets("authorization: Bearer abc.def.ghi")).not.toContain(
      "abc.def.ghi",
    );
    expect(redactSecrets("Basic dXNlcjpwYXNz")).toContain(REDACTED);
  });

  it("strips key, token, secret and password assignments", () => {
    const text = "api_key=sk-live-1234567890\npassword: hunter2";
    const out = redactSecrets(text);

    expect(out).not.toContain("sk-live-1234567890");
    expect(out).not.toContain("hunter2");
  });

  it("strips token-shaped blobs and hex digests", () => {
    const out = redactSecrets(
      "sha 0123456789abcdef0123456789abcdef and AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );

    expect(out).not.toContain("0123456789abcdef");
    expect(out).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  });

  it("strips e-mails and query strings", () => {
    const out = redactSecrets("mail me at user@example.com or use /x?q=1&y=2");

    expect(out).not.toContain("user@example.com");
    expect(out).not.toContain("q=1");
  });

  it("leaves ordinary task text alone", () => {
    const text = "Fix the login redirect loop in the settings page";

    expect(redactSecrets(text)).toBe(text);
    expect(redactionCount(text)).toBe(0);
  });

  it("counts placeholders", () => {
    expect(redactionCount(`a ${REDACTED} b ${REDACTED}`)).toBe(2);
  });
});
