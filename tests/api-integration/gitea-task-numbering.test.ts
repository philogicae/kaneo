import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { importGiteaIssues } from "../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import createTask from "../../apps/api/src/task/controllers/create-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    listIssues: async () => [
      {
        number: 1,
        title: "Imported issue",
        body: "Body",
        state: "open",
        labels: [],
        html_url: "https://gitea.example/owner/repo/issues/1",
      },
    ],
    listPulls: async () => [],
    listIssueComments: async () => [],
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
});
async function setup() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    config: JSON.stringify({
      baseUrl: "https://gitea.example",
      accessToken: "fake-local-token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    }),
  });
  return { user, project };
}

describe("Gitea import task numbers", () => {
  it("advances the shared counter before a normal task is created", async () => {
    const { user, project } = await setup();
    expect(await importGiteaIssues(project.id)).toMatchObject({ imported: 1 });
    const task = await createTask({
      projectId: project.id,
      currentUserId: user.id,
      title: "Next",
      status: "to-do",
    });
    expect(task.number).toBe(2);
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      }),
    ).toHaveProperty("lastTaskNumber", 2);
  });

  it("serializes import and concurrent ordinary creation through one counter", async () => {
    const { user, project } = await setup();
    const [imported] = await Promise.all([
      importGiteaIssues(project.id),
      ...Array.from({ length: 3 }, (_, index) =>
        createTask({
          projectId: project.id,
          currentUserId: user.id,
          title: `Concurrent ${index}`,
          status: "to-do",
        }),
      ),
    ]);
    expect(imported).toMatchObject({ imported: 1 });
    const tasks = await db.query.taskTable.findMany();
    expect(tasks.map((task) => task.number).sort()).toEqual([1, 2, 3, 4]);
  });
});
