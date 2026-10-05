import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getMemberAccessCtrl from "./controllers/get-member-access";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import updateMemberAccessCtrl from "./controllers/update-member-access";
import {
  workspaceMemberAccessSchema,
  workspaceMemberListSchema,
} from "./response";
import {
  memberAccessBody,
  memberAccessParam,
  workspaceIdParam,
} from "./schema";

const getWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMembers",
  path: "/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "Get workspace members",
  description: "Get all members of a workspace, with their role.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("List of workspace members", workspaceMemberListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getMemberAccessRoute = createRoute({
  method: "get",
  operationId: "getMemberAccess",
  path: "/{workspaceId}/members/{userId}/access",
  tags: ["Workspaces"],
  summary: "Get a member's direct access",
  description:
    "Direct workspace/project grants recorded for a member outside teams, with the membership scope. Restricted to members who can invite (admins, owners, or a role carrying invitation:create).",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ invitation: ["create"] }),
  ] as const,
  request: { params: memberAccessParam },
  responses: {
    200: jsonResponse("Direct member access", workspaceMemberAccessSchema),
    403: errorResponse("Insufficient permissions"),
    404: errorResponse("Unknown workspace member"),
  },
});

// Replacing the direct grants keeps a member's access editable without a
// team: "all projects" lifts the scope back to full, clearing everything
// removes the grants and drops an orphaned scoped membership.
const updateMemberAccessRoute = createRoute({
  method: "put",
  operationId: "updateMemberAccess",
  path: "/{workspaceId}/members/{userId}/access",
  tags: ["Workspaces"],
  summary: "Update a member's direct access",
  description:
    'Replace a member\'s direct grants for this workspace: "allProjects" covers every project, otherwise the listed projects are granted. Clearing both removes the direct grants (and the membership when no team or other grant still justifies it).',
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ invitation: ["create"] }),
  ] as const,
  request: {
    params: memberAccessParam,
    body: {
      required: true,
      content: { "application/json": { schema: memberAccessBody } },
    },
  },
  responses: {
    200: jsonResponse("Updated member access", workspaceMemberAccessSchema),
    400: errorResponse("Unknown project in this workspace"),
    403: errorResponse("Insufficient permissions"),
    404: errorResponse("Unknown workspace member"),
  },
});

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(await getWorkspaceMembersCtrl(c.get("workspaceId")), 200),
  )
  .openapi(getMemberAccessRoute, async (c) => {
    const { userId } = c.req.valid("param");
    return c.json(await getMemberAccessCtrl(c.get("workspaceId"), userId), 200);
  })
  .openapi(updateMemberAccessRoute, async (c) => {
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(
      await updateMemberAccessCtrl(
        c.get("workspaceId"),
        userId,
        body,
        c.get("userId"),
      ),
      200,
    );
  });

export default workspace;
