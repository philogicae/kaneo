import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable } from "../database/schema";
import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { publishEvent } from "../events";
import { normalizeApiServerUrl } from "../utils/openapi-spec";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import {
  deleteS3Object,
  getPrivateObject,
  isImageContentType,
  validateTaskAssetUploadInput,
  writeAssetObject,
} from "../storage/s3";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import archiveProjectCtrl from "./controllers/archive-project";
import createProjectCtrl from "./controllers/create-project";
import deleteProjectCtrl from "./controllers/delete-project";
import getProjectCtrl from "./controllers/get-project";
import getProjectCharts from "./controllers/get-project-charts";
import getProjectMembers from "./controllers/get-project-members";
import getProjectsCtrl from "./controllers/get-projects";
import moveProjectCtrl from "./controllers/move-project";
import reorderProjectsCtrl from "./controllers/reorder-projects";
import unarchiveProjectCtrl from "./controllers/unarchive-project";
import updateProjectCtrl from "./controllers/update-project";
import {
  movedProjectSchema,
  projectChartsSchema,
  projectListSchema,
  projectMemberListSchema,
  projectSchema,
  toPublicProject,
} from "./response";
import {
  createProjectBody,
  getProjectTasksQuery,
  listProjectsQuery,
  moveProjectBody,
  projectChartsQuery,
  projectParam,
  reorderProjectsBody,
  updateProjectBody,
  workspaceIdQuery,
} from "./schema";

const moveProjectRoute = createRoute({
  method: "put",
  path: "/{id}/move",
  operationId: "moveProject",
  tags: ["Projects"],
  summary: "Move a project to another workspace",
  description:
    "Move a project and its tasks. Requires update and delete permission in the source, plus project creation and workspace settings management permission in the destination. Remove cross-project task relationships before moving.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update", "delete"] }),
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: { "application/json": { schema: moveProjectBody } },
    },
  },
  responses: {
    200: jsonResponse("Project moved", movedProjectSchema),
    400: errorResponse("Invalid destination or same workspace"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Missing workspace access or permission"),
    404: errorResponse("Project not found in the source workspace"),
    // A project is still being moved by another request.
    409: errorResponse(
      "Project key conflict or cross-project task relationships",
    ),
  },
});

const listProjectsRoute = createRoute({
  method: "get",
  operationId: "listProjects",
  path: "/",
  tags: ["Projects"],
  summary: "List projects",
  description:
    "List a workspace's projects in sidebar order, each with rollup task statistics. Archived projects are excluded unless includeArchived is set.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: listProjectsQuery },
  responses: {
    200: jsonResponse("List of projects", projectListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const createProjectRoute = createRoute({
  method: "post",
  operationId: "createProject",
  path: "/",
  tags: ["Projects"],
  summary: "Create project",
  description:
    "Create a project in a workspace. The slug becomes the prefix of its task identifiers.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createProjectBody } },
    },
  },
  responses: {
    200: jsonResponse("The created project", projectSchema),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing project:create permission",
    ),
    409: errorResponse("Another project in the workspace uses this key"),
  },
});

const getProjectRoute = createRoute({
  method: "get",
  operationId: "getProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Get project",
  description: "Get a single project by ID.",
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam, query: getProjectTasksQuery },
  responses: {
    200: jsonResponse("Project details", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getProjectChartsRoute = createRoute({
  method: "get",
  operationId: "getProjectCharts",
  path: "/{id}/charts",
  tags: ["Projects"],
  summary: "Get project charts",
  description:
    'Task-creation and completion counts for the selected window (default "1m"), bucketed at the requested unit. `created` counts tasks created in the bucket; `completed` counts status changes into a final status. Ranges: "1w", "1m", "3m", "6m", "12m" or "all"; units: "hour", "day", "week" or "month" (hour only for "1w", day up to "12m", week/month for every range). The unit defaults to "day", or "week" for ranges without a daily reading ("all").',
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam, query: projectChartsQuery },
  responses: {
    200: jsonResponse("Progression buckets", z.array(projectChartsSchema)),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getProjectMembersRoute = createRoute({
  method: "get",
  operationId: "getProjectMembers",
  path: "/{id}/members",
  tags: ["Projects"],
  summary: "Get project members",
  description:
    "Workspace members who can access this project: full workspace access, or a scoped membership with an explicit grant; instance admins are included. Feeds the assignee and mention pickers so nobody is offered work in a project they cannot open.",
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse(
      "Members with access to the project",
      projectMemberListSchema,
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const reorderProjectsRoute = createRoute({
  method: "put",
  operationId: "reorderProjects",
  path: "/reorder",
  tags: ["Projects"],
  summary: "Reorder projects",
  description:
    "Set the sidebar order of a workspace's projects. The given positions express relative order only -- the workspace is renumbered to 0..n-1.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    query: workspaceIdQuery,
    body: {
      required: true,
      content: { "application/json": { schema: reorderProjectsBody } },
    },
  },
  responses: {
    // Reorder returns the plain project rows, without the list route's
    // rollup statistics.
    200: jsonResponse("The reordered projects", z.array(projectSchema)),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateProjectRoute = createRoute({
  method: "put",
  operationId: "updateProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Update project",
  description:
    "Replace a project's name, icon, slug, description, and visibility.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateProjectBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated project", projectSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    409: errorResponse("Another project in the workspace uses the new key"),
  },
});

const deleteProjectRoute = createRoute({
  method: "delete",
  operationId: "deleteProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Delete project",
  description:
    "Permanently delete a project and everything in it. Archive it instead to keep the data.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["delete"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The deleted project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:delete permission",
    ),
  },
});

const archiveProjectRoute = createRoute({
  method: "put",
  operationId: "archiveProject",
  path: "/{id}/archive",
  tags: ["Projects"],
  summary: "Archive project",
  description:
    "Hide a project from the default list without deleting it. Reversible with unarchive.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The archived project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const requestProjectBackgroundUploadRoute = createRoute({
  method: "put",
  operationId: "requestProjectBackgroundUpload",
  path: "/{id}/background",
  tags: ["Projects"],
  summary: "Request a project background upload",
  description:
    "Reserve a background upload and return the same-origin URL the browser should PUT the bytes to.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            contentType: z.string().min(1),
            size: z.number().int().positive(),
            version: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "The reserved upload",
      z.object({
        key: z.string(),
        uploadUrl: z.string(),
        headers: z.record(z.string(), z.string()),
      }),
    ),
    400: errorResponse("Unsupported image type or oversized upload"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const putProjectBackgroundBlobRoute = createRoute({
  method: "post",
  operationId: "uploadProjectBackground",
  path: "/{id}/background/blob",
  tags: ["Projects"],
  summary: "Upload project background bytes",
  description:
    "Store the bytes for a background upload reserved by the request route, then point the project at them.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectParam,
    query: z.object({ key: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/octet-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored background",
      z.object({
        backgroundVersion: z.string().nullable(),
        contentType: z.string().nullable(),
      }),
    ),
    400: errorResponse("Key mismatch or oversized upload"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const getProjectBackgroundRoute = createRoute({
  method: "get",
  operationId: "getProjectBackground",
  path: "/{id}/background",
  tags: ["Projects"],
  summary: "Download project background",
  description: "Download the current project board background image.",
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam },
  responses: {
    200: {
      description: "The project background image",
      content: {
        "image/*": { schema: { type: "string", format: "binary" } },
      },
    },
    304: { description: "Not modified" },
    404: errorResponse("Project background not found"),
  },
});

const deleteProjectBackgroundRoute = createRoute({
  method: "delete",
  operationId: "deleteProjectBackground",
  path: "/{id}/background",
  tags: ["Projects"],
  summary: "Delete project background",
  description: "Remove the current project board background image.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    204: { description: "Project background removed" },
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const unarchiveProjectRoute = createRoute({
  method: "put",
  operationId: "unarchiveProject",
  path: "/{id}/unarchive",
  tags: ["Projects"],
  summary: "Unarchive project",
  description: "Return an archived project to the default list.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The restored project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    409: errorResponse("Another project in the workspace uses this key"),
  },
});

const project = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(moveProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { workspaceId: targetWorkspaceId } = c.req.valid("json");
    const sourceWorkspaceId = c.get("workspaceId");
    const userId = c.get("userId");
    // The request was authorized against the source workspace only, so the
    // destination is checked separately before anything is rewritten.
    await validateWorkspaceAccess(userId, targetWorkspaceId);
    if (
      !(await hasWorkspacePermission(
        c,
        { project: ["create"], workspace: ["manage_settings"] },
        targetWorkspaceId,
      ))
    )
      throw new HTTPException(403, {
        message: "Insufficient permissions in the target workspace",
      });
    return c.json(
      await moveProjectCtrl(id, sourceWorkspaceId, targetWorkspaceId, userId),
      200,
    );
  })
  .openapi(listProjectsRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { includeArchived } = c.req.valid("query");
    const projects = await getProjectsCtrl(
      workspaceId,
      includeArchived === "true",
      c.get("userId"),
    );
    return c.json(projects.map(toPublicProject), 200);
  })
  .openapi(createProjectRoute, async (c) => {
    const { name, icon, slug, description } = c.req.valid("json");
    const workspaceId = c.get("workspaceId");
    const newProject = await createProjectCtrl(
      workspaceId,
      name,
      icon,
      slug,
      description ?? null,
      c.get("userId"),
    );
    return c.json(toPublicProject(newProject), 200);
  })
  .openapi(getProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { tasksLimit, tasksOffset } = c.req.valid("query");
    const workspaceId = c.get("workspaceId");
    const projectData = await getProjectCtrl(id, workspaceId, {
      tasksLimit,
      tasksOffset,
    });
    return c.json(toPublicProject(projectData), 200);
  })
  .openapi(getProjectChartsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { range, unit } = c.req.valid("query");
    const buckets = await getProjectCharts(id, range, unit);
    return c.json(buckets, 200);
  })
  .openapi(getProjectMembersRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getProjectMembers(id), 200);
  })
  .openapi(requestProjectBackgroundUploadRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { contentType, size, version } = c.req.valid("json");

    // The stored object is served back to browsers, so only image types are
    // accepted; the declared type is validated again when the bytes arrive.
    if (!isImageContentType(contentType)) {
      throw new HTTPException(400, { message: "Unsupported image type" });
    }
    try {
      validateTaskAssetUploadInput(contentType, size);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error
            ? error.message
            : "Invalid image upload request",
      });
    }

    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, id))
      .limit(1);
    if (!project) {
      throw new HTTPException(404, { message: "Project not found" });
    }

    // The key is derived server-side, so a caller cannot choose where its
    // bytes land; it is echoed back only to be verified on upload.
    const key = `projects/${project.workspaceId}/${id}/background`;
    const apiBaseUrl = normalizeApiServerUrl(
      process.env.KANEO_API_URL || new URL(c.req.url).origin,
    );

    return c.json(
      {
        key,
        uploadUrl: `${apiBaseUrl}/project/${encodeURIComponent(id)}/background/blob?key=${encodeURIComponent(key)}`,
        headers: {
          "Content-Type": contentType,
          "X-Background-Version": version,
        },
      },
      200,
    );
  })
  .openapi(putProjectBackgroundBlobRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { key } = c.req.valid("query");
    const version = c.req.header("X-Background-Version");
    const contentType = c.req.header("Content-Type") || "";

    if (!version) {
      throw new HTTPException(400, { message: "Missing background version" });
    }
    if (!isImageContentType(contentType)) {
      throw new HTTPException(400, { message: "Unsupported image type" });
    }

    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, id))
      .limit(1);
    if (!project) {
      throw new HTTPException(404, { message: "Project not found" });
    }

    // Only the key this project would generate is accepted, so a caller cannot
    // overwrite another project's background.
    const expectedKey = `projects/${project.workspaceId}/${id}/background`;
    if (key !== expectedKey) {
      throw new HTTPException(400, { message: "Invalid background key" });
    }

    const bytes = new Uint8Array(await c.req.arrayBuffer());
    try {
      validateTaskAssetUploadInput(contentType, bytes.byteLength);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error
            ? error.message
            : "Invalid image upload request",
      });
    }

    await writeAssetObject(key, bytes);

    const [updated] = await db
      .update(projectTable)
      .set({
        backgroundObjectKey: key,
        backgroundMimeType: contentType,
        backgroundVersion: version,
      })
      .where(eq(projectTable.id, id))
      .returning({ id: projectTable.id });

    if (!updated) {
      await deleteS3Object(key).catch(() => {});
      throw new HTTPException(404, { message: "Project not found" });
    }

    await publishEvent("project.updated", { projectId: id });
    return c.json({ backgroundVersion: version, contentType }, 200);
  })
  .openapi(getProjectBackgroundRoute, async (c) => {
    const { id } = c.req.valid("param");
    const [projectData] = await db
      .select({
        backgroundObjectKey: projectTable.backgroundObjectKey,
        backgroundMimeType: projectTable.backgroundMimeType,
        backgroundVersion: projectTable.backgroundVersion,
      })
      .from(projectTable)
      .where(eq(projectTable.id, id))
      .limit(1);

    if (!projectData?.backgroundObjectKey) {
      throw new HTTPException(404, {
        message: "Project background not found",
      });
    }

    try {
      const object = await getPrivateObject(projectData.backgroundObjectKey);
      const contentType = (
        object.contentType ||
        projectData.backgroundMimeType ||
        ""
      )
        .toLowerCase()
        .split(";")[0]
        ?.trim();

      // The key is storage-internal, so an object that is not an image must
      // not be served with a sniffed content type.
      if (!contentType || !isImageContentType(contentType)) {
        await (object.body as ReadableStream).cancel();
        throw new HTTPException(404, {
          message: "Project background not found",
        });
      }

      const etag = object.etag || `"${projectData.backgroundVersion}"`;
      const headers: Record<string, string> = {
        "Cache-Control": "private, max-age=300, must-revalidate",
        "Content-Type": contentType,
        ETag: etag,
        Vary: "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
      };
      if (object.contentLength !== undefined) {
        headers["Content-Length"] = object.contentLength.toString();
      }
      if (object.lastModified) {
        headers["Last-Modified"] = object.lastModified.toUTCString();
      }

      if (c.req.header("If-None-Match") === etag) {
        await (object.body as ReadableStream).cancel();
        return new Response(null, { status: 304, headers });
      }

      return new Response(object.body as BodyInit, { headers });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      console.error("Failed to stream project background:", error);
      throw new HTTPException(404, {
        message: "Project background not found",
      });
    }
  })
  .openapi(reorderProjectsRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { projects } = c.req.valid("json");
    const reordered = await reorderProjectsCtrl(workspaceId, projects);
    return c.json(reordered.map(toPublicProject), 200);
  })
  .openapi(updateProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { name, icon, slug, description, isPublic } = c.req.valid("json");
    const workspaceId = c.get("workspaceId");
    const updatedProject = await updateProjectCtrl(
      id,
      name,
      icon,
      slug,
      description,
      isPublic,
      workspaceId,
      // Publishing a project is a separate capability from editing it.
      await hasWorkspacePermission(c, { project: ["share"] }),
    );
    return c.json(toPublicProject(updatedProject), 200);
  })
  .openapi(deleteProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const deletedProject = await deleteProjectCtrl(id, workspaceId);
    return c.json(toPublicProject(deletedProject), 200);
  })
  .openapi(archiveProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const archivedProject = await archiveProjectCtrl(id, workspaceId);
    return c.json(toPublicProject(archivedProject), 200);
  })
  .openapi(unarchiveProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const unarchivedProject = await unarchiveProjectCtrl(id, workspaceId);
    return c.json(toPublicProject(unarchivedProject), 200);
  })
  .openapi(deleteProjectBackgroundRoute, async (c) => {
    const { id } = c.req.valid("param");
    const [currentProject] = await db
      .select({ backgroundObjectKey: projectTable.backgroundObjectKey })
      .from(projectTable)
      .where(eq(projectTable.id, id))
      .limit(1);

    const [updatedProject] = await db
      .update(projectTable)
      .set({
        backgroundObjectKey: null,
        backgroundMimeType: null,
        backgroundVersion: null,
      })
      .where(eq(projectTable.id, id))
      .returning({ id: projectTable.id });

    // The row is cleared first, so a failed unlink leaves an orphan object
    // rather than a project pointing at a deleted one.
    if (updatedProject && currentProject?.backgroundObjectKey) {
      deleteS3Object(currentProject.backgroundObjectKey).catch(() => {});
    }

    if (updatedProject) {
      await publishEvent("project.updated", { projectId: id });
    }

    return c.body(null, 204);
  });

export default project;
