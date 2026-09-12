import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as schema from "../../../apps/api/src/database/schema";

const mockSelect = vi.fn();
const mockUpdate = vi.fn(() => ({
  set: () => ({
    where: () => ({
      returning: () => mockUpdateReturning(),
    }),
  }),
}));
const mockUpdateReturning = vi.fn(() => Promise.resolve([]));
const mockWorkspaceFindFirst = vi.fn(() => Promise.resolve(undefined));
const mockMemberFindFirst = vi.fn(() => Promise.resolve(undefined));
const mockAddMember = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  __esModule: true,
  default: {
    update: () => mockUpdate(),
    query: {
      workspaceTable: {
        findFirst: (...args: unknown[]) => mockWorkspaceFindFirst(...args),
      },
      workspaceUserTable: {
        findFirst: (...args: unknown[]) => mockMemberFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
  schema,
}));

vi.mock("../../../apps/api/src/auth", () => ({
  auth: { api: { addMember: (...args: unknown[]) => mockAddMember(...args) } },
}));

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

  it("returns idempotent success for an existing member instead of a 500", async () => {
    mockUpdateReturning.mockReturnValueOnce(
      Promise.resolve([{ workspaceId: "ws-1" }]),
    );
    vi.mocked(mockAddMember).mockRejectedValueOnce(new Error("member exists"));
    mockMemberFindFirst.mockResolvedValueOnce({ role: "member" });
    mockWorkspaceFindFirst.mockResolvedValueOnce({ id: "ws-1", name: "WS" });

    const result = await acceptInviteLink("user-1", "fresh-token");

    expect(result).toEqual({
      workspaceId: "ws-1",
      workspaceName: "WS",
      role: "member",
    });
    // Consume and rollback both ran: no use slot is burned for a re-click.
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("reports the existing role when an owner re-clicks the link", async () => {
    mockUpdateReturning.mockReturnValueOnce(
      Promise.resolve([{ workspaceId: "ws-1" }]),
    );
    vi.mocked(mockAddMember).mockRejectedValueOnce(new Error("member exists"));
    mockMemberFindFirst.mockResolvedValueOnce({ role: "owner" });
    mockWorkspaceFindFirst.mockResolvedValueOnce({ id: "ws-1", name: "WS" });

    const result = await acceptInviteLink("user-1", "fresh-token");

    expect(result).toEqual({
      workspaceId: "ws-1",
      workspaceName: "WS",
      role: "owner",
    });
  });

  it("still fails when addMember fails for a genuine non-member", async () => {
    mockUpdateReturning.mockReturnValueOnce(
      Promise.resolve([{ workspaceId: "ws-1" }]),
    );
    vi.mocked(mockAddMember).mockRejectedValueOnce(new Error("boom"));

    await expect(acceptInviteLink("user-1", "fresh-token")).rejects.toThrow(
      HTTPException,
    );
    // The reservation is rolled back before the failure surfaces.
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
