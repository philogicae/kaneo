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

type TaskSeed = {
  title: string;
  number: number;
  status?: string;
  priority?: string;
  userId?: string | null;
  dueDate?: Date | null;
};

async function seedTask(
  project: { id: string },
  columnId: string,
  seed: TaskSeed,
) {
  const { default: db } = await import("../../apps/api/src/database");
  const { schema } = await import("../../apps/api/src/database");
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: seed.title,
      status: seed.status ?? "to-do",
      columnId,
      priority: seed.priority ?? "medium",
      number: seed.number,
      position: seed.number,
      userId: seed.userId ?? null,
      dueDate: seed.dueDate ?? null,
    })
    .returning();
  return task;
}

async function seedLabel(taskId: string, name: string, color = "red") {
  const { default: db } = await import("../../apps/api/src/database");
  const { schema } = await import("../../apps/api/src/database");
  await db.insert(schema.labelTable).values({ taskId, name, color });
}

describe("workspace task listing", () => {
  it("lists tasks across the workspace's projects, never another workspace's", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Alpha",
    });
    const other = await createWorkspaceMember({
      userName: "Beta Owner",
      workspaceName: "Beta",
    });
    const first = await createProjectFixture({
      workspaceId: workspace.id,
      name: "One",
      slug: "ONE",
    });
    const second = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Two",
      slug: "TWO",
    });
    const hidden = await createProjectFixture({
      workspaceId: other.workspace.id,
      name: "Elsewhere",
      slug: "ELSE",
    });

    await seedTask(first.project, first.columns.todo.id, {
      title: "Alpha task",
      number: 1,
    });
    await seedTask(second.project, second.columns.todo.id, {
      title: "Beta task",
      number: 1,
    });
    await seedTask(hidden.project, hidden.columns.todo.id, {
      title: "Hidden task",
      number: 1,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/workspace/${workspace.id}?limit=10`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      tasks: Array<{ title: string; projectSlug: string }>;
      pagination: { total: number; page: number; totalPages: number };
    };

    expect(body.tasks).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.totalPages).toBe(1);
    expect(body.tasks.map((task) => task.projectSlug).sort()).toEqual([
      "ONE",
      "TWO",
    ]);
  });

  it("filters by status, priority, assignee, label, text and due window", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Filtered",
    });
    const project = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Filters",
      slug: "FIL",
    });

    const urgent = await seedTask(project.project, project.columns.todo.id, {
      title: "Fix urgent login redirect",
      number: 1,
      status: "to-do",
      priority: "urgent",
      userId: user.id,
      dueDate: new Date("2026-09-25T12:00:00.000Z"),
    });
    await seedTask(project.project, project.columns.todo.id, {
      title: "Unassigned docs work",
      number: 2,
      status: "planned",
      priority: "low",
      dueDate: new Date("2026-10-30T12:00:00.000Z"),
    });
    await seedLabel(urgent.id, "bug");

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const byStatus = await app.request(
      `/api/task/workspace/${workspace.id}?status=planned`,
    );
    const statusBody = (await byStatus.json()) as {
      tasks: Array<{ title: string }>;
    };
    expect(statusBody.tasks.map((task) => task.title)).toEqual([
      "Unassigned docs work",
    ]);

    const byPriority = await app.request(
      `/api/task/workspace/${workspace.id}?priority=urgent`,
    );
    expect(
      ((await byPriority.json()) as { pagination: { total: number } })
        .pagination.total,
    ).toBe(1);

    const byAssignee = await app.request(
      `/api/task/workspace/${workspace.id}?assigneeId=unassigned`,
    );
    expect(
      (
        (await byAssignee.json()) as { tasks: Array<{ title: string }> }
      ).tasks.map((task) => task.title),
    ).toEqual(["Unassigned docs work"]);

    const byLabel = await app.request(
      `/api/task/workspace/${workspace.id}?label=bug`,
    );
    expect(
      ((await byLabel.json()) as { tasks: Array<{ title: string }> }).tasks.map(
        (task) => task.title,
      ),
    ).toEqual(["Fix urgent login redirect"]);

    const byText = await app.request(
      `/api/task/workspace/${workspace.id}?q=docs`,
    );
    expect(
      ((await byText.json()) as { tasks: Array<{ title: string }> }).tasks.map(
        (task) => task.title,
      ),
    ).toEqual(["Unassigned docs work"]);

    const byDue = await app.request(
      `/api/task/workspace/${workspace.id}?dueBefore=2026-09-30T00:00:00.000Z`,
    );
    expect(
      ((await byDue.json()) as { tasks: Array<{ title: string }> }).tasks.map(
        (task) => task.title,
      ),
    ).toEqual(["Fix urgent login redirect"]);
  });

  it("pages with page/limit and reports the total", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Paged",
    });
    const project = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Pages",
      slug: "PAG",
    });
    for (let index = 1; index <= 5; index += 1) {
      await seedTask(project.project, project.columns.todo.id, {
        title: `Task ${index}`,
        number: index,
      });
    }

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const firstPage = await app.request(
      `/api/task/workspace/${workspace.id}?page=1&limit=2&sortBy=number&sortOrder=asc`,
    );
    const firstBody = (await firstPage.json()) as {
      tasks: Array<{ number: number }>;
      pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    };
    expect(firstBody.tasks.map((task) => task.number)).toEqual([1, 2]);
    expect(firstBody.pagination).toEqual({
      total: 5,
      page: 1,
      pageSize: 2,
      totalPages: 3,
    });

    const lastPage = await app.request(
      `/api/task/workspace/${workspace.id}?page=3&limit=2&sortBy=number&sortOrder=asc`,
    );
    const lastBody = (await lastPage.json()) as {
      tasks: Array<{ number: number }>;
    };
    expect(lastBody.tasks.map((task) => task.number)).toEqual([5]);
  });
});
