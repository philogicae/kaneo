import { responseTimestamp, z } from "../openapi";

export const accessTeamProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const accessTeamWorkspaceSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  allProjects: z.boolean(),
  projects: z.array(accessTeamProjectSchema).openapi({
    description: "Explicitly covered projects; empty when allProjects is true.",
  }),
});

export const accessTeamMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
});

export const accessTeamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    canManage: z.boolean().openapi({
      description:
        "True when the caller administers every workspace in the team scope (or is an instance admin).",
    }),
    workspaces: z.array(accessTeamWorkspaceSchema),
    members: z.array(accessTeamMemberSchema),
  })
  .openapi("AccessTeam");

export const accessTeamListSchema = z.array(accessTeamSchema);

export const manageableWorkspaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    projects: z.array(
      z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    ),
  })
  .openapi("ManageableWorkspace");

export const manageableWorkspaceListSchema = z.array(manageableWorkspaceSchema);
