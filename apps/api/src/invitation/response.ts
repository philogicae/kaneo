import { responseTimestamp, z } from "../openapi";

export const pendingInvitationSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    inviterName: z.string(),
    expiresAt: responseTimestamp,
    createdAt: responseTimestamp,
    status: z.string().openapi({
      description:
        "Always `pending` here; expired and accepted ones are filtered out.",
    }),
  })
  .openapi("PendingInvitation");

export const pendingInvitationListSchema = z.array(pendingInvitationSchema);

export const createdInvitationSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    status: z.string(),
    expiresAt: responseTimestamp,
    workspaceCount: z.number().openapi({
      description:
        "Distinct workspaces the invitation opens (manual grants plus the workspace scope of the selected teams).",
    }),
    teamCount: z.number(),
  })
  .openapi("CreatedInvitation");

export const invitationDetailsSchema = z
  .object({
    valid: z.boolean().openapi({
      description: "True only when the invitation can still be accepted.",
    }),
    invitation: z
      .object({
        id: z.string(),
        email: z.string(),
        workspaceName: z.string(),
        inviterName: z.string(),
        expiresAt: responseTimestamp,
        status: z.string(),
        expired: z.boolean(),
      })
      .optional()
      .openapi({
        description:
          "Omitted when the invitation does not exist, was already accepted, or was canceled -- the details are withheld rather than leaked.",
      }),
    error: z.string().optional().openapi({
      description: "Why the invitation is unusable, when valid is false.",
    }),
  })
  .openapi("InvitationDetails");
