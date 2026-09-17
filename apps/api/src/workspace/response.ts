import { z } from "../openapi";

export const workspaceMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().openapi({
      description:
        "The member's workspace role: a built-in role (owner, admin, member, guest) or a custom role name.",
    }),
  })
  .openapi("WorkspaceMember");

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);

export const workspaceMemberAccessSchema = z
  .object({
    accessScope: z.string().openapi({
      description:
        'Membership scope: "full", "scoped", or "none" once the member was removed with their last grant.',
    }),
    allProjects: z.boolean().openapi({
      description:
        "Whether a direct grant covers every project of the workspace.",
    }),
    projectIds: z.array(z.string()).openapi({
      description: "Projects granted directly to the member, outside teams.",
    }),
  })
  .openapi("WorkspaceMemberAccess");
