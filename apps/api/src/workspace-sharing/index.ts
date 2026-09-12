import { HTTPException } from "hono/http-exception";
import { deletedSchema } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  acceptInviteLink,
  createInviteLink,
  deleteInviteLink,
  getInviteLinkDetails,
  listInviteLinks,
} from "./controllers/workspace-sharing-controller";
import {
  acceptInviteLinkResponseSchema,
  workspaceInviteLinkListSchema,
  workspaceInviteLinkPublicSchema,
  workspaceInviteLinkSchema,
} from "./response";
import { createInviteLinkBody, linkIdParam, linkTokenParam } from "./schema";

const createLinkRoute = createRoute({
  method: "post",
  operationId: "createWorkspaceInviteLink",
  path: "/",
  tags: ["Workspace sharing"],
  summary: "Create a shareable invite link",
  description:
    "Generates a reusable public link that joins anyone to this workspace with the member role. Options: expiry (hours) and a total usage limit.",
  middleware: [
    workspaceAccess.fromBody("workspaceId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createInviteLinkBody } },
    },
  },
  responses: {
    200: jsonResponse("The created link", workspaceInviteLinkSchema),
    403: errorResponse("Insufficient permissions"),
    404: errorResponse("Workspace not found"),
  },
});

const listLinksRoute = createRoute({
  method: "get",
  operationId: "listWorkspaceInviteLinks",
  path: "/",
  tags: ["Workspace sharing"],
  summary: "List the workspace's shareable invite links",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    query: z.object({ workspaceId: z.string() }),
  },
  responses: {
    200: jsonResponse("The workspace's links", workspaceInviteLinkListSchema),
    403: errorResponse("Insufficient permissions"),
  },
});

const deleteLinkRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspaceInviteLink",
  path: "/{id}",
  tags: ["Workspace sharing"],
  summary: "Revoke a shareable invite link",
  description:
    "Deletes the link when it belongs to the workspaceId in the query, and the caller has workspace:manage_settings there.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: linkIdParam,
    query: z.object({ workspaceId: z.string() }),
  },
  responses: {
    200: jsonResponse("The link was revoked", deletedSchema),
    403: errorResponse("Insufficient permissions"),
    404: errorResponse("Invite link not found"),
  },
});

const getPublicLinkRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceInviteLinkPublic",
  path: "/public/{token}",
  tags: ["Workspace sharing"],
  summary: "Look up a shareable invite link",
  description:
    "Public endpoint. Always 200 -- an unusable link is reported with valid: false and a reason rather than an error status.",
  security: [],
  request: { params: linkTokenParam },
  responses: {
    200: jsonResponse("Link details", workspaceInviteLinkPublicSchema),
  },
});

const acceptLinkRoute = createRoute({
  method: "post",
  operationId: "acceptWorkspaceInviteLink",
  path: "/public/{token}/accept",
  tags: ["Workspace sharing"],
  summary: "Join the workspace via a shareable link",
  description:
    "Public endpoint, but the caller must be authenticated: the signed-in user joins the workspace with the member role.",
  security: [],
  request: { params: linkTokenParam },
  responses: {
    200: jsonResponse("Workspace membership", acceptInviteLinkResponseSchema),
    401: errorResponse("Sign in first"),
    410: errorResponse(
      "The invite link is expired, exhausted, or does not exist",
    ),
  },
});

const workspaceSharing = apiRouter<
  BaseVariables & { workspaceId: string; id: string; token: string }
>()
  .openapi(createLinkRoute, async (c) => {
    const { workspaceId, expiresInHours, maxUses } = c.req.valid("json");
    const link = await createInviteLink(c.get("userId"), workspaceId, {
      expiresInHours,
      maxUses,
    });
    return c.json(link, 200);
  })
  .openapi(listLinksRoute, async (c) =>
    c.json(await listInviteLinks(c.get("workspaceId")), 200),
  )
  .openapi(deleteLinkRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const deleted = await deleteInviteLink(workspaceId, id);
    if (!deleted) {
      throw new HTTPException(404, { message: "Invite link not found" });
    }
    return c.json({ success: true }, 200);
  })
  .openapi(getPublicLinkRoute, async (c) => {
    const { token } = c.req.valid("param");
    const details = await getInviteLinkDetails(token);
    return c.json(
      details.valid
        ? {
            valid: true,
            workspaceName: details.workspaceName,
            createdAt: details.createdAt.toISOString(),
          }
        : {
            valid: false,
            workspaceName: details.workspaceName ?? undefined,
            error: details.error ?? undefined,
          },
      200,
    );
  })
  .openapi(acceptLinkRoute, async (c) =>
    c.json(
      await acceptInviteLink(c.get("userId"), c.req.valid("param").token),
      200,
    ),
  );

export default workspaceSharing;
