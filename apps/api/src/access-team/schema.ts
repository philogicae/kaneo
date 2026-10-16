import { z } from "../openapi";

export const teamParam = z.object({ id: z.string() });

export const teamMemberParam = z.object({ id: z.string(), userId: z.string() });

export const listTeamsQuery = z.object({
  workspaceId: z.string().optional().openapi({
    description:
      "Only return teams whose scope covers this workspace, the teams the caller belongs to, and (for workspace admins) teams scoped to workspaces they administer.",
  }),
});

export const teamWorkspaceScope = z.object({
  workspaceId: z.string(),
  allProjects: z.boolean().openapi({
    description:
      "When true the team covers every project of the workspace, including future ones.",
  }),
  projectIds: z.array(z.string()).optional().openapi({
    description:
      "Projects covered by the team when allProjects is false; at least one is required.",
  }),
});

export const createTeamBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workspaces: z.array(teamWorkspaceScope).min(1),
});

export const updateTeamBody = createTeamBody;

export const teamMemberBody = z.object({
  userId: z.string(),
});
