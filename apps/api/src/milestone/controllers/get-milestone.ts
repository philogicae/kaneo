import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

async function getMilestone(id: string) {
  const milestone = await db.query.milestoneTable.findFirst({
    where: eq(milestoneTable.id, id),
  });

  if (!milestone) {
    throw new HTTPException(404, { message: "Milestone not found" });
  }

  return milestone;
}

export default getMilestone;
