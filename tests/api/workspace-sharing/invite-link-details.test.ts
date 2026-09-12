import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as schema from "../../../apps/api/src/database/schema";

const mockSelect = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  __esModule: true,
  default: {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }),
    query: {
      workspaceTable: {
        findFirst: (...args: unknown[]) => Promise.resolve(args[0]?.rows),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
  schema,
}));

vi.mock("../../../apps/api/src/auth", () => ({ auth: {} }));

// Regression coverage for the shareable invite link details endpoint: the
// route contract is "always 200", unusable links are reported as
// valid: false with a reason instead of an HTTP error.
import {
  acceptInviteLink,
  getInviteLinkDetails,
} from "../../../apps/api/src/workspace-sharing/controllers/workspace-sharing-controller";

function mockLookup(row: unknown) {
  mockSelect.mockImplementationOnce(() => {
    const chain: {
      limit: () => Promise<unknown[]>;
      from: () => unknown;
      innerJoin: () => unknown;
      where: () => unknown;
    } = {
      limit: () => Promise.resolve(row ? [row] : []),
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
    };
    return chain;
  });
}

describe("workspace shareable invite links", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports an unknown token as invalid", async () => {
    mockLookup(null);
    const details = await getInviteLinkDetails("unknown-token");
    expect(details).toEqual({
      valid: false,
      error: "This invite link does not exist",
    });
  });

  it("reports an expired link with a reason", async () => {
    mockLookup({
      role: "member",
      expiresAt: new Date(Date.now() - 1000),
      maxUses: null,
      usedCount: 0,
      createdAt: new Date(),
      workspaceName: "WS",
    });
    const details = await getInviteLinkDetails("expired-token");
    expect(details.valid).toBe(false);
    if (!details.valid) {
      expect(details.error).toContain("expired");
    }
  });

  it("reports an exhausted link with a reason", async () => {
    mockLookup({
      role: "member",
      expiresAt: null,
      maxUses: 1,
      usedCount: 3,
      createdAt: new Date(),
      workspaceName: "WS",
    });
    const details = await getInviteLinkDetails("used-token");
    expect(details.valid).toBe(false);
    if (!details.valid) {
      expect(details.error).toContain("limit");
    }
  });

  it("returns the workspace name for a valid link", async () => {
    mockLookup({
      role: "member",
      expiresAt: new Date(Date.now() + 60_000),
      maxUses: 5,
      usedCount: 0,
      createdAt: new Date(),
      workspaceName: "WS",
    });
    const details = await getInviteLinkDetails("fresh-token");
    expect(details.valid).toBe(true);
    if (details.valid) {
      expect(details.workspaceName).toBe("WS");
    }
  });

  it("rejects consuming a dead link with an HTTP error", async () => {
    mockLookup(null);
    await expect(acceptInviteLink("user", "dead")).rejects.toThrow(
      HTTPException,
    );
  });
});
