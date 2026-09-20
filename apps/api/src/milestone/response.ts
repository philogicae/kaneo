import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const milestoneSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().openapi({
      description:
        "Semantic palette name (resolved by the web) or a hex color.",
    }),
    position: z.number().openapi({
      description: "Left-to-right order in the roadmap, ascending.",
    }),
    startDate: nullableResponseTimestamp,
    endDate: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Milestone");

export const milestoneListSchema = z
  .array(milestoneSchema)
  .openapi("MilestoneList");
