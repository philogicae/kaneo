import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

type UpdateMilestoneInput = {
  name: string;
  description?: string | null;
  color: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

async function updateMilestone(id: string, input: UpdateMilestoneInput) {
  const existing = await db.query.milestoneTable.findFirst({
    where: eq(milestoneTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Milestone not found" });
  }

  const [updated] = await db
    .update(milestoneTable)
    .set({
      name: input.name,
      description:
        input.description !== undefined
          ? input.description
          : existing.description,
      color: input.color,
      startDate:
        input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
    })
    .where(eq(milestoneTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update milestone" });
  }

  return updated;
}

export default updateMilestone;
