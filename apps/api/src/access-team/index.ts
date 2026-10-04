import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import listTeams, {
  getTeam,
  listManageableWorkspaces,
} from "./controllers/list-teams";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  removeTeamMember,
  updateTeam,
} from "./controllers/manage-teams";
import {
  accessTeamListSchema,
  accessTeamSchema,
  manageableWorkspaceListSchema,
} from "./response";
import {
  createTeamBody,
  listTeamsQuery,
  teamMemberBody,
  teamMemberParam,
  teamParam,
  updateTeamBody,
} from "./schema";

const listTeamsRoute = createRoute({
  method: "get",
  operationId: "listAccessTeams",
  path: "/",
  tags: ["Access teams"],
  summary: "List access teams",
  description:
    "Reusable scope bundles (workspaces and projects) assignable to members. Instance admins see every team; workspace admins see the teams whose scope intersects the workspaces they administer; members see the teams they belong to.",
  request: { query: listTeamsQuery },
  responses: {
    200: jsonResponse("Visible access teams", accessTeamListSchema),
  },
});

const getTeamRoute = createRoute({
  method: "get",
  operationId: "getAccessTeam",
  path: "/{id}",
  tags: ["Access teams"],
  summary: "Get an access team",
  description:
    "Team detail with its workspace/project scope and members. Teams outside the caller's visibility return 404.",
  request: { params: teamParam },
  responses: {
    200: jsonResponse("Access team detail", accessTeamSchema),
    404: errorResponse("Unknown team, or not visible to the caller"),
  },
});

const listManageableWorkspacesRoute = createRoute({
  method: "get",
  operationId: "listManageableWorkspaces",
  path: "/manageable-workspaces",
  tags: ["Access teams"],
  summary: "List workspaces the caller can grant access to",
  description:
    "Workspaces the caller administers (every workspace for instance admins), with their projects, for the access-scope editors.",
  responses: {
    200: jsonResponse(
      "Manageable workspaces with their projects",
      manageableWorkspaceListSchema,
    ),
  },
});

const createTeamRoute = createRoute({
  method: "post",
  operationId: "createAccessTeam",
  path: "/",
  tags: ["Access teams"],
  summary: "Create an access team",
  description:
    "Creates a scope bundle. The caller must administer every workspace in the scope (instance admins bypass).",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTeamBody } },
    },
  },
  responses: {
    200: jsonResponse("Created access team", accessTeamSchema),
    400: errorResponse("Invalid scope"),
    403: errorResponse("Not allowed to manage one of the workspaces"),
    409: errorResponse("A team with this name already exists"),
  },
});

const updateTeamRoute = createRoute({
  method: "put",
  operationId: "updateAccessTeam",
  path: "/{id}",
  tags: ["Access teams"],
  summary: "Update an access team",
  description:
    "Replaces the name, description and scope. Memberships materialised from removed workspaces are cleaned up when no other grant remains.",
  request: {
    params: teamParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTeamBody } },
    },
  },
  responses: {
    200: jsonResponse("Updated access team", accessTeamSchema),
    400: errorResponse("Invalid scope"),
    403: errorResponse("Not allowed to manage one of the workspaces"),
    404: errorResponse("Unknown team"),
    409: errorResponse("A team with this name already exists"),
  },
});

const deleteTeamRoute = createRoute({
  method: "delete",
  operationId: "deleteAccessTeam",
  path: "/{id}",
  tags: ["Access teams"],
  summary: "Delete an access team",
  description:
    "Deletes the team and revokes the scoped memberships it was the only source of.",
  request: { params: teamParam },
  responses: {
    200: jsonResponse("Deleted team id", z.object({ id: z.string() })),
    403: errorResponse("Not allowed to manage one of the workspaces"),
    404: errorResponse("Unknown team"),
  },
});

const addTeamMemberRoute = createRoute({
  method: "post",
  operationId: "addAccessTeamMember",
  path: "/{id}/members",
  tags: ["Access teams"],
  summary: "Add a member to an access team",
  description:
    "Adds the user to the team and materialises a scoped workspace membership for every workspace the team covers.",
  request: {
    params: teamParam,
    body: {
      required: true,
      content: { "application/json": { schema: teamMemberBody } },
    },
  },
  responses: {
    200: jsonResponse("Team after adding the member", accessTeamSchema),
    403: errorResponse("Not allowed to manage the team"),
    404: errorResponse("Unknown team or user"),
  },
});

const removeTeamMemberRoute = createRoute({
  method: "delete",
  operationId: "removeAccessTeamMember",
  path: "/{id}/members/{userId}",
  tags: ["Access teams"],
  summary: "Remove a member from an access team",
  description:
    "Removes the user from the team and revokes the scoped membership when no other grant justifies it.",
  request: { params: teamMemberParam },
  responses: {
    200: jsonResponse("Team after removing the member", accessTeamSchema),
    403: errorResponse("Not allowed to manage the team"),
    404: errorResponse("Unknown team"),
  },
});

const accessTeam = apiRouter()
  .openapi(listManageableWorkspacesRoute, async (c) =>
    c.json(await listManageableWorkspaces(c.get("userId") as string), 200),
  )
  .openapi(listTeamsRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    return c.json(await listTeams(c.get("userId") as string, workspaceId), 200);
  })
  .openapi(getTeamRoute, async (c) => {
    const team = await getTeam(
      c.req.valid("param").id,
      c.get("userId") as string,
    );
    if (!team) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    return c.json(team, 200);
  })
  .openapi(createTeamRoute, async (c) => {
    const team = await createTeam(
      c.get("userId") as string,
      c.req.valid("json"),
    );
    return c.json(team, 200);
  })
  .openapi(updateTeamRoute, async (c) => {
    const team = await updateTeam(
      c.get("userId") as string,
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    if (!team) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    return c.json(team, 200);
  })
  .openapi(deleteTeamRoute, async (c) => {
    const deleted = await deleteTeam(
      c.get("userId") as string,
      c.req.valid("param").id,
    );
    if (!deleted) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    return c.json(deleted, 200);
  })
  .openapi(addTeamMemberRoute, async (c) => {
    const team = await addTeamMember(
      c.get("userId") as string,
      c.req.valid("param").id,
      c.req.valid("json").userId,
    );
    if (!team) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    return c.json(team, 200);
  })
  .openapi(removeTeamMemberRoute, async (c) => {
    const params = c.req.valid("param");
    const team = await removeTeamMember(
      c.get("userId") as string,
      params.id,
      params.userId,
    );
    if (!team) {
      throw new HTTPException(404, { message: "Team not found" });
    }
    return c.json(team, 200);
  });

export default accessTeam;
