import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function seedTask(
  projectId: string,
  columnId: string,
  title: string,
  number: number,
) {
  const { default: db } = await import("../../apps/api/src/database");
  const { schema } = await import("../../apps/api/src/database");
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title,
      status: "to-do",
      columnId,
      priority: "medium",
      number,
      position: number,
    })
    .returning();
  return task;
}

describe("project task relations", () => {
  it("returns only relations whose two endpoints are in the project", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Relations",
    });
    const first = await createProjectFixture({
      workspaceId: workspace.id,
      name: "First",
      slug: "FST",
    });
    const second = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Second",
      slug: "SND",
    });

    const a = await seedTask(first.project.id, first.columns.todo.id, "A", 1);
    const b = await seedTask(first.project.id, first.columns.todo.id, "B", 2);
    const foreign = await seedTask(
      second.project.id,
      second.columns.todo.id,
      "Foreign",
      1,
    );

    const { default: db } = await import("../../apps/api/src/database");
    const { schema } = await import("../../apps/api/src/database");
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: a.id,
      targetTaskId: b.id,
      relationType: "blocks",
    });
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: a.id,
      targetTaskId: foreign.id,
      relationType: "blocks",
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task-relation/project/${first.project.id}`,
    );
    expect(response.status).toBe(200);
    const relations = (await response.json()) as Array<{
      sourceTaskId: string;
      targetTaskId: string;
      relationType: string;
    }>;

    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      sourceTaskId: a.id,
      targetTaskId: b.id,
      relationType: "blocks",
    });
  });
});
