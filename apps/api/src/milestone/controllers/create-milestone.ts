import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

type CreateMilestoneInput = {
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  startDate?: Date;
  endDate?: Date;
};

async function createMilestone(input: CreateMilestoneInput) {
  const [last] = await db
    .select({ position: milestoneTable.position })
    .from(milestoneTable)
    .where(eq(milestoneTable.projectId, input.projectId))
    .orderBy(desc(milestoneTable.position))
    .limit(1);

  const [milestone] = await db
    .insert(milestoneTable)
    .values({
      projectId: input.projectId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "sky",
      position: (last?.position ?? -1) + 1,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    })
    .returning();

  return milestone;
}

export default createMilestone;
