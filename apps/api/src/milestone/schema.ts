import { z } from "../openapi";

export const milestoneParam = z.object({ id: z.string() });

export const milestoneColorSchema = z.string().openapi({
  description:
    "Semantic palette name shared with labels (gray, purple, teal, green, orange, sky, yellow, pink, red, blue, cyan, indigo, fuchsia, lime, emerald), or a hex color.",
});

export const createMilestoneBody = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  color: milestoneColorSchema.optional(),
  startDate: z.string().optional().openapi({
    description: "Optional ISO 8601 date-time.",
  }),
  endDate: z.string().optional().openapi({
    description: "Optional ISO 8601 date-time.",
  }),
});

// Full-body update, like labels: fetch the milestone, merge, then PUT.
export const updateMilestoneBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: milestoneColorSchema,
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const reorderMilestonesBody = z.object({
  milestones: z
    .array(
      z.object({
        id: z.string(),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const assignTaskMilestoneBody = z.object({
  milestoneId: z.string().nullable().openapi({
    description: "Milestone to move the task into, or null to clear it.",
  }),
});
