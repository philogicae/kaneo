import { PROJECT_ACCESS_MODES } from "../project-access/project-access-mode";
import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const memberAccessParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

export const memberAccessBody = z.object({
  allProjects: z.boolean().openapi({
    description:
      "When true the member covers every project of the workspace, including future ones.",
  }),
  projectIds: z.array(z.string()).optional().openapi({
    description:
      "Projects granted when allProjects is false. Clearing both grants removes the member's direct access to the workspace.",
  }),
});

export const workspaceMemberParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

export const workspaceMembersQuery = z.object({
  projectId: z.string().optional().openapi({
    description:
      "Only return members who can access this project, for example to fill an assignee picker.",
  }),
});

export const updateMemberProjectAccessBody = z.object({
  projectAccess: z.enum(PROJECT_ACCESS_MODES).openapi({
    description:
      '"all" gives access to every project in the workspace, including future ones. "selected" limits the member to projectIds.',
  }),
  projectIds: z.array(z.string()).default([]).openapi({
    description:
      'Projects the member can access when projectAccess is "selected".',
  }),
});
