import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable } from "../../database/schema";

async function updateLabel(id: string, name: string, requestedColor: string) {
  return db.transaction(async (tx) => {
    const label = await tx.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    });

    if (!label) {
      throw new HTTPException(404, {
        message: "Label not found",
      });
    }

    let color = requestedColor;

    if (label.taskId && label.workspaceId) {
      // A label name identifies one label per workspace: renaming a task-level
      // copy onto an existing workspace definition turns it into a mirror of
      // that definition, so it inherits the definition's color instead of
      // creating a same-name label with a diverging color.
      const [definition] = await tx
        .select({ color: labelTable.color })
        .from(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, label.workspaceId),
            eq(labelTable.name, name),
            isNull(labelTable.taskId),
          ),
        )
        .limit(1);
      color = definition?.color ?? requestedColor;
    } else if (label.workspaceId) {
      // Names must stay unique per workspace at the definition level: fail
      // with a clear error instead of the raw unique-index violation.
      const [duplicate] = await tx
        .select({ id: labelTable.id })
        .from(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, label.workspaceId),
            eq(labelTable.name, name),
            isNull(labelTable.taskId),
            ne(labelTable.id, label.id),
          ),
        )
        .limit(1);

      if (duplicate) {
        throw new HTTPException(400, {
          message: "A label with this name already exists in this workspace",
        });
      }
    }

    const [updatedLabel] = await tx
      .update(labelTable)
      .set({ name, color })
      .where(eq(labelTable.id, id))
      .returning();

    // If this is a workspace-level label, cascade the changes to all
    // task-level copies so existing label assignments reflect the new color/name
    if (!label.taskId && label.workspaceId) {
      await tx
        .update(labelTable)
        .set({ name, color })
        .where(
          and(
            eq(labelTable.workspaceId, label.workspaceId),
            eq(labelTable.name, label.name),
            isNotNull(labelTable.taskId),
          ),
        );
    }

    return updatedLabel;
  });
}

export default updateLabel;
