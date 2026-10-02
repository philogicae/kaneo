import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateLabel(id: string, name: string, requestedColor: string) {
  const result = await db.transaction(async (tx) => {
    const label = await tx.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    });

    if (!label) {
      throw new HTTPException(404, {
        message: "Label not found",
      });
    }

    // A label pending removal is a snapshot of what is being torn down, not an
    // editable record: renaming or recolouring it would either be lost or
    // resurrect copies the cascade is about to detach.
    if (label.deletionStartedAt) {
      throw new HTTPException(409, {
        message: "This label is being deleted; resume its deletion instead",
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
      .where(and(eq(labelTable.id, id), isNull(labelTable.deletionStartedAt)))
      .returning();

    if (!updatedLabel) {
      throw new HTTPException(409, { message: "This label is being deleted" });
    }

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

    // Workspace labels appear in every board's choices, including unassigned
    // labels. Publish only project IDs within this workspace after commit.
    const projects =
      !label.taskId && label.workspaceId
        ? await tx
            .select({ projectId: projectTable.id })
            .from(projectTable)
            .where(eq(projectTable.workspaceId, label.workspaceId))
        : await tx
            .selectDistinct({ projectId: taskTable.projectId })
            .from(labelTable)
            .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
            .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
            .where(
              and(
                label.taskId
                  ? eq(labelTable.id, id)
                  : and(
                      eq(labelTable.workspaceId, label.workspaceId ?? ""),
                      eq(labelTable.name, name),
                    ),
                eq(projectTable.workspaceId, label.workspaceId ?? ""),
              ),
            );

    return { updatedLabel, projects };
  });

  for (const { projectId } of result.projects) {
    await publishEvent("project.updated", { projectId });
  }

  return result.updatedLabel;
}

export default updateLabel;
