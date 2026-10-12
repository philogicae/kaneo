import { z } from "../openapi";

export const workspaceIdBody = z.object({
  workspaceId: z.string(),
});

export const linkIdParam = z.object({ id: z.string() });

export const linkTokenParam = z.object({ token: z.string() });

export const createInviteLinkBody = z.object({
  workspaceId: z.string(),
  expiresInHours: z.number().int().min(1).optional().openapi({
    description:
      "Link lifetime in hours (e.g. 24 or 168). Omit for a never-expiring link.",
  }),
  maxUses: z.number().int().min(1).optional(),
});
