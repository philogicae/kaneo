import { z } from "../openapi";
import { pagingNumber } from "../utils/paging";

export const projectParam = z.object({ id: z.string() });

export const getProjectTasksQuery = z.object({
  tasksLimit: pagingNumber(1, 200)
    .optional()
    .openapi({ description: "Maximum number of tasks to embed." }),
  tasksOffset: pagingNumber(0, 1_000_000)
    .optional()
    .openapi({ description: "Number of tasks to skip; use with tasksLimit." }),
});

export const workspaceIdQuery = z.object({ workspaceId: z.string() });

export const listProjectsQuery = z.object({
  workspaceId: z.string(),
  includeArchived: z.string().optional().openapi({
    description: 'Pass "true" to include archived projects in the list.',
  }),
});

export const createProjectBody = z.object({
  name: z.string(),
  workspaceId: z.string(),
  icon: z.string(),
  slug: z.string(),
  description: z.string().optional(),
});

export const updateProjectBody = z.object({
  name: z.string(),
  icon: z.string(),
  slug: z.string(),
  description: z.string(),
  isPublic: z.boolean(),
});

export const reorderProjectsBody = z.object({
  // Positions express a relative order only; the controller renumbers the
  // workspace to 0..n-1, so the values just have to be sane.
  projects: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .min(1),
});
