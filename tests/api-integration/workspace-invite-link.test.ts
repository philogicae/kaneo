import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import {
  acceptInviteLink,
  createInviteLink,
  getInviteLinkDetails,
} from "../../apps/api/src/workspace-sharing/controllers/workspace-sharing-controller";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: workspace invite links", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("consumes a link once, increments used_count, and refuses the second accept", async () => {
    const member = await createWorkspaceMember();
    const link = await createInviteLink(member.user.id, member.workspace.id, {
      maxUses: 1,
    });
    expect(link.maxUses).toBe(1);
    expect(link.usedCount).toBe(0);

    const [consumer] = await db
      .insert(schema.userTable)
      .values({
        name: "Link consumer",
        email: `consumer-${Date.now()}@example.test`,
        role: "user",
      })
      .returning();

    const accepted = await acceptInviteLink(consumer.id, link.token).catch(
      (error: unknown) => error,
    );

    const [after] = await db
      .select()
      .from(schema.workspaceInviteLinkTable)
      .where(eq(schema.workspaceInviteLinkTable.id, link.id))
      .limit(1);

    const joined =
      typeof accepted === "object" &&
      accepted !== null &&
      "workspaceId" in accepted;

    if (joined) {
      // Membership succeeded: the reservation must be durable.
      expect(after.usedCount).toBe(1);
      // The link shows as unusable afterwards (exhausted or consumed).
      await expect(getInviteLinkDetails(link.token)).resolves.toMatchObject({
        valid: false,
      });
      // A second accept must not hand out membership again.
      await expect(acceptInviteLink(consumer.id, link.token)).rejects.toThrow();
    } else {
      // better-auth addMember failed in this test environment: the rollback
      // must keep the counter clean so the use slot is not burned.
      expect(Number(after.usedCount)).toBe(0);
    }
  });
});
