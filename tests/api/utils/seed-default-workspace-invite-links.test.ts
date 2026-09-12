import { afterEach, describe, expect, it, vi } from "vitest";

import * as schema from "../../../apps/api/src/database/schema";

const mockValues = vi.fn((..._args: unknown[]) => Promise.resolve([{}]));
const mockInsert = vi.fn((..._args: unknown[]) => ({ values: mockValues }));

vi.mock("../../../apps/api/src/database", () => ({
  __esModule: true,
  default: { insert: (...args: unknown[]) => mockInsert(...args) },
  schema,
}));

import { createDefaultWorkspaceInviteLink } from "../../../apps/api/src/utils/seed-default-workspace-invite-links";

describe("createDefaultWorkspaceInviteLink", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a member link with no expiry and no use limit", async () => {
    await createDefaultWorkspaceInviteLink("ws-1", "user-1");

    expect(mockInsert).toHaveBeenCalledWith(schema.workspaceInviteLinkTable);
    expect(mockValues).toHaveBeenCalledTimes(1);

    const values = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values).toMatchObject({
      workspaceId: "ws-1",
      role: "member",
      createdBy: "user-1",
    });
    // No expiry / unlimited uses is the default case: the columns stay unset
    // and fall back to the table defaults (null / 0).
    expect(values).not.toHaveProperty("expiresAt");
    expect(values).not.toHaveProperty("maxUses");
    expect(typeof values.token).toBe("string");
    expect((values.token as string).length).toBeGreaterThanOrEqual(32);
  });
});
