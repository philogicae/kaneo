import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { validateAndParseDate } from "../utils/validate-dates";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createMilestone from "./controllers/create-milestone";
import deleteMilestone from "./controllers/delete-milestone";
import getMilestone from "./controllers/get-milestone";
import listMilestones from "./controllers/list-milestones";
import reorderMilestones from "./controllers/reorder-milestones";
import updateMilestone from "./controllers/update-milestone";
import { milestoneListSchema, milestoneSchema } from "./response";
import {
  createMilestoneBody,
  milestoneParam,
  reorderMilestonesBody,
  updateMilestoneBody,
} from "./schema";

export const milestoneListQuery = z.object({ projectId: z.string() });

const listMilestonesRoute = createRoute({
  method: "get",
  operationId: "listMilestones",
  path: "/",
  tags: ["Milestones"],
  summary: "List milestones",
  description:
    "List a project's sprints/phases (roadmap zones), ordered left to right by `position`.",
  middleware: [
    workspaceAccess.fromProjectQuery("projectId"),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { query: milestoneListQuery },
  responses: {
    200: jsonResponse("The project's milestones", milestoneListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getMilestoneRoute = createRoute({
  method: "get",
  operationId: "getMilestone",
  path: "/{id}",
  tags: ["Milestones"],
  summary: "Get milestone",
  description: "Get a milestone by id.",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse("The milestone", milestoneSchema),
    400: errorResponse("Unknown milestone"),
    403: errorResponse("No access to the milestone's workspace"),
    404: errorResponse("Milestone not found"),
  },
});

const createMilestoneRoute = createRoute({
  method: "post",
  operationId: "createMilestone",
  path: "/",
  tags: ["Milestones"],
  summary: "Create milestone",
  description:
    "Add a sprint/phase to a project; it appends to the right of the roadmap. Tasks can then be assigned with the task milestone endpoint.",
  middleware: [
    workspaceAccess.fromProjectId("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createMilestoneBody } },
    },
  },
  responses: {
    200: jsonResponse("Milestone created", milestoneSchema),
    400: errorResponse("Invalid body, or workspace could not be determined"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const reorderMilestonesRoute = createRoute({
  method: "put",
  operationId: "reorderMilestones",
  path: "/reorder/{projectId}",
  tags: ["Milestones"],
  summary: "Reorder milestones",
  description:
    "Set the roadmap order of a project's milestones. Every milestone of the project must be listed exactly once with its new position.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: z.object({ projectId: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: reorderMilestonesBody } },
    },
  },
  responses: {
    200: jsonResponse("Reordered milestones", milestoneListSchema),
    400: errorResponse(
      "Unknown project, or the list does not cover every milestone",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateMilestoneRoute = createRoute({
  method: "put",
  operationId: "updateMilestone",
  path: "/{id}",
  tags: ["Milestones"],
  summary: "Update milestone",
  description:
    "Update a milestone (fetch it, merge supplied fields, then send a full body). Null dates clear them; tasks assigned to it keep existing.",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: milestoneParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateMilestoneBody } },
    },
  },
  responses: {
    200: jsonResponse("Milestone updated", milestoneSchema),
    400: errorResponse("Invalid body, or unknown milestone"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteMilestoneRoute = createRoute({
  method: "delete",
  operationId: "deleteMilestone",
  path: "/{id}",
  tags: ["Milestones"],
  summary: "Delete milestone",
  description:
    "Delete a sprint/phase. Its tasks are kept and fall back to the roadmap's no-sprint lane.",
  middleware: [
    workspaceAccess.fromMilestone(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse("Milestone deleted", milestoneSchema),
    400: errorResponse("Unknown milestone"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Milestone not found"),
  },
});

const milestone = apiRouter()
  .openapi(listMilestonesRoute, async (c) => {
    const { projectId } = c.req.valid("query");
    return c.json(await listMilestones(projectId), 200);
  })
  .openapi(getMilestoneRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getMilestone(id), 200);
  })
  .openapi(createMilestoneRoute, async (c) => {
    const body = c.req.valid("json");
    return c.json(
      await createMilestone({
        projectId: body.projectId,
        name: body.name,
        description: body.description,
        color: body.color,
        startDate:
          body.startDate !== undefined
            ? validateAndParseDate(body.startDate, "startDate")
            : undefined,
        endDate:
          body.endDate !== undefined
            ? validateAndParseDate(body.endDate, "endDate")
            : undefined,
      }),
      200,
    );
  })
  .openapi(reorderMilestonesRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { milestones } = c.req.valid("json");
    return c.json(await reorderMilestones(projectId, milestones), 200);
  })
  .openapi(updateMilestoneRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(
      await updateMilestone(id, {
        name: body.name,
        description: body.description,
        color: body.color,
        startDate:
          body.startDate === undefined
            ? undefined
            : body.startDate === null
              ? null
              : validateAndParseDate(body.startDate, "startDate"),
        endDate:
          body.endDate === undefined
            ? undefined
            : body.endDate === null
              ? null
              : validateAndParseDate(body.endDate, "endDate"),
      }),
      200,
    );
  })
  .openapi(deleteMilestoneRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteMilestone(id), 200);
  });

export default milestone;
