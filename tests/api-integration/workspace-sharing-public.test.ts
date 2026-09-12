import { describe, expect, it } from "vitest";

import { createApp } from "../../apps/api/src/index";

// Regression coverage for the public invite-link endpoints: the lookup must
// bypass the global API authentication middleware (signed-out visitors open
// these links), while the accept route keeps requiring a session.
describe("API integration: public invite-link endpoints", () => {
  it("serves the public lookup without authentication", async () => {
    const { app } = createApp();

    const response = await app.request(
      "/api/workspace-sharing/public/does-not-exist",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      error: "This invite link does not exist",
    });
  });

  it("still requires authentication to accept a link", async () => {
    const { app } = createApp();

    const response = await app.request(
      "/api/workspace-sharing/public/does-not-exist/accept",
      { method: "POST" },
    );

    expect(response.status).toBe(401);
  });
});
