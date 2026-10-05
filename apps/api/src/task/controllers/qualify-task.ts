import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  labelTable,
  projectTable,
  workspaceTable,
} from "../../database/schema";
import type { JevAsker } from "../../jev/client";
import {
  type QualificationLabel,
  suggestTaskQualification,
  type TaskQualification,
} from "../../jev/qualify";

export type QualificationContext = {
  workspaceId: string;
  projectName: string;
  workspaceName: string;
  labels: QualificationLabel[];
};

// Everything the qualification asks Jev about: the workspace's semantic label
// definitions (task-scoped copies excluded) plus naming context.
export async function loadQualificationContext(
  projectId: string,
): Promise<QualificationContext> {
  const [project] = await db
    .select({
      name: projectTable.name,
      workspaceId: projectTable.workspaceId,
      workspaceName: workspaceTable.name,
    })
    .from(projectTable)
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const labels = await db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
    })
    .from(labelTable)
    .where(
      and(
        eq(labelTable.workspaceId, project.workspaceId),
        isNull(labelTable.taskId),
      ),
    );

  return {
    workspaceId: project.workspaceId,
    projectName: project.name,
    workspaceName: project.workspaceName,
    labels,
  };
}

async function qualifyTask(input: {
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  ask?: JevAsker;
}): Promise<TaskQualification | null> {
  const context = await loadQualificationContext(input.projectId);

  return suggestTaskQualification({
    title: input.title,
    description: input.description,
    projectName: context.projectName,
    workspaceName: context.workspaceName,
    labels: context.labels,
    providedPriority: input.priority,
    ask: input.ask,
  });
}

export default qualifyTask;
