import { responseTimestamp, z } from "../openapi";

export const workspaceInviteLinkSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    token: z.string(),
    role: z.string(),
    expiresAt: responseTimestamp.nullable(),
    maxUses: z.number().nullable(),
    usedCount: z.number(),
    createdAt: responseTimestamp,
  })
  .openapi("WorkspaceInviteLink");

export const workspaceInviteLinkListSchema = z.array(workspaceInviteLinkSchema);

export const workspaceInviteLinkPublicSchema = z
  .object({
    valid: z.boolean(),
    workspaceName: z.string().optional(),
    createdAt: responseTimestamp.optional(),
    error: z.string().optional().openapi({
      description: "Why the link is unusable, when valid is false.",
    }),
  })
  .openapi("WorkspaceInviteLinkPublic");

export const acceptInviteLinkResponseSchema = z
  .object({
    workspaceId: z.string(),
    workspaceName: z.string(),
    role: z.string(),
  })
  .openapi("WorkspaceInviteLinkAccepted");
