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
  number = 1,
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

describe("milestones (roadmap sprints)", () => {
  it("creates, lists, updates, reorders and deletes milestones", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "admin",
      workspaceName: "Roadmap",
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Graph",
      slug: "GRF",
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await app.request("/api/milestone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, name: "Sprint 1" }),
    });
    expect(first.status).toBe(200);
    const firstMilestone = (await first.json()) as {
      id: string;
      position: number;
      color: string;
    };
    expect(firstMilestone.position).toBe(0);
    expect(firstMilestone.color).toBe("sky");

    const second = await app.request("/api/milestone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Sprint 2",
        color: "teal",
      }),
    });
    const secondMilestone = (await second.json()) as { id: string };

    const listed = await app.request(`/api/milestone?projectId=${project.id}`);
    const list = (await listed.json()) as Array<{ id: string; name: string }>;
    expect(list.map((row) => row.name)).toEqual(["Sprint 1", "Sprint 2"]);

    const updated = await app.request(`/api/milestone/${firstMilestone.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Sprint 1 (revised)", color: "purple" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      name: "Sprint 1 (revised)",
      color: "purple",
    });

    const reordered = await app.request(
      `/api/milestone/reorder/${project.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          milestones: [
            { id: secondMilestone.id, position: 0 },
            { id: firstMilestone.id, position: 1 },
          ],
        }),
      },
    );
    expect(reordered.status).toBe(200);
    const reorderedList = (await reordered.json()) as Array<{ id: string }>;
    expect(reorderedList.map((row) => row.id)).toEqual([
      secondMilestone.id,
      firstMilestone.id,
    ]);

    const partialReorder = await app.request(
      `/api/milestone/reorder/${project.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          milestones: [{ id: secondMilestone.id, position: 0 }],
        }),
      },
    );
    expect(partialReorder.status).toBe(400);

    const deleted = await app.request(`/api/milestone/${firstMilestone.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const afterDelete = await app.request(
      `/api/milestone?projectId=${project.id}`,
    );
    expect(await afterDelete.json()).toHaveLength(1);
  });

  it("assigns and clears a task's milestone, keeping the task on delete", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "admin",
      workspaceName: "Assign",
    });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Assigned",
      slug: "ASG",
    });
    const other = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Other",
      slug: "OTH",
    });

    const milestoneResponse = await (async () => {
      mockAuthenticatedSession(user);
      const { app } = createApp();
      return app.request("/api/milestone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, name: "Phase 1" }),
      });
    })();
    const milestone = (await milestoneResponse.json()) as { id: string };

    const foreign = await (async () => {
      const { app } = createApp();
      return app.request("/api/milestone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: other.project.id,
          name: "Elsewhere",
        }),
      });
    })();
    const foreignMilestone = (await foreign.json()) as { id: string };

    const task = await seedTask(project.id, columns.todo.id, "Node");

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const assigned = await app.request(`/api/task/milestone/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ milestoneId: milestone.id }),
    });
    expect(assigned.status).toBe(200);
    expect(await assigned.json()).toMatchObject({ milestoneId: milestone.id });

    const crossProject = await app.request(`/api/task/milestone/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ milestoneId: foreignMilestone.id }),
    });
    expect(crossProject.status).toBe(400);

    const cleared = await app.request(`/api/task/milestone/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ milestoneId: null }),
    });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ milestoneId: null });

    // Deleting a milestone keeps its tasks (assignment falls back to null).
    await app.request(`/api/task/milestone/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ milestoneId: milestone.id }),
    });
    const removed = await app.request(`/api/milestone/${milestone.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);

    const taskAfter = await app.request(`/api/task/${task.id}`);
    expect(taskAfter.status).toBe(200);
    expect(await taskAfter.json()).toMatchObject({ milestoneId: null });
  });
});
