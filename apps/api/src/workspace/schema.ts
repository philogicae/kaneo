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
