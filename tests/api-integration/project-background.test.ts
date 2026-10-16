import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/storage/s3")>()),
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
}));

function jsonRequest(method: string, body: unknown) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("API integration: project backgrounds", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await initializeWebSocketAdapter();
  });
  afterEach(async () => {
    await shutdownWebSocketAdapter();
    vi.unstubAllEnvs();
  });

  it("publishes upload and removal to another connected session without leaking storage fields", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const socket = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    const connection = addConnection(
      project.id,
      socket as unknown as WSContext,
      owner.user.id,
      "other-session",
      owner.workspace.id,
    );
    try {
      // The browser never talks to a storage provider: it reserves a
      // same-origin upload URL, then POSTs the bytes to it.
      const reserved = await app.request(
        `/api/project/${project.id}/background`,
        jsonRequest("PUT", {
          contentType: "image/png",
          size: 12,
          version: "v1",
        }),
      );
      expect(reserved.status).toBe(200);
      const upload = (await reserved.json()) as { uploadUrl: string };
      const finalized = await app.request(
        new URL(upload.uploadUrl).pathname + new URL(upload.uploadUrl).search,
        {
          method: "POST",
          headers: {
            "content-type": "image/png",
            "x-background-version": "v1",
          },
          body: new Uint8Array(12),
        },
      );
      expect(finalized.status).toBe(200);
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "PROJECT_UPDATED", projectId: project.id }),
        ),
      );
      socket.send.mockClear();
      for (const path of [
        `/api/project/${project.id}?workspaceId=${owner.workspace.id}`,
        `/api/project?workspaceId=${owner.workspace.id}`,
        `/api/task/tasks/${project.id}`,
      ]) {
        const response = await app.request(path);
        expect(response.status).toBe(200);
        const body = await response.json();
        const data = Array.isArray(body) ? body[0] : (body.data ?? body);
        expect(data.backgroundVersion).toBe("v1");
        expect(data).not.toHaveProperty("backgroundObjectKey");
        expect(data).not.toHaveProperty("backgroundMimeType");
      }
      const updated = await app.request(
        `/api/project/${project.id}`,
        jsonRequest("PUT", {
          name: project.name,
          icon: "Folder",
          slug: project.slug,
          description: "",
          isPublic: false,
        }),
      );
      expect(updated.status).toBe(200);
      expect(await updated.json()).not.toHaveProperty("backgroundObjectKey");
      const removed = await app.request(
        `/api/project/${project.id}/background`,
        {
          method: "DELETE",
        },
      );
      expect(removed.status).toBe(204);
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "PROJECT_UPDATED", projectId: project.id }),
        ),
      );
      const row = await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      });
      expect(row).toMatchObject({
        backgroundVersion: null,
        backgroundObjectKey: null,
        backgroundMimeType: null,
      });
    } finally {
      removeConnection(project.id, connection);
    }
  });

  it("rejects background mutations without project update permission", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();
    for (const [path, init] of [
      [
        `/api/project/${project.id}/background`,
        jsonRequest("PUT", {
          contentType: "image/png",
          size: 12,
          version: "v1",
        }),
      ],
      [
        `/api/project/${project.id}/background/blob?key=key`,
        { method: "POST", headers: { "content-type": "image/png" } },
      ],
      [`/api/project/${project.id}/background`, { method: "DELETE" }],
    ] as const)
      expect((await app.request(path, init)).status).toBe(403);
  });
});
