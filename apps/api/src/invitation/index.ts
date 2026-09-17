import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import createInvitation from "./controllers/create-invitation";
import getInvitationDetailsController from "./controllers/get-invitation-details";
import getUserPendingInvitations from "./controllers/get-user-pending-invitations";
import {
  createdInvitationSchema,
  invitationDetailsSchema,
  pendingInvitationListSchema,
} from "./response";
import { createInvitationBody, invitationParam } from "./schema";

const getPendingRoute = createRoute({
  method: "get",
  operationId: "getUserPendingInvitations",
  path: "/pending",
  tags: ["Invitations"],
  summary: "Get pending invitations",
  description:
    "Get the current user's unexpired, unaccepted invitations. Returns an empty list until the user's email is verified.",
  responses: {
    200: jsonResponse(
      "List of pending invitations",
      pendingInvitationListSchema,
    ),
  },
});

const getInvitationRoute = createRoute({
  method: "get",
  operationId: "getInvitationDetails",
  path: "/{id}",
  tags: ["Invitations"],
  summary: "Get invitation details",
  description:
    "Look up an invitation by ID. Always 200 -- an unusable invitation is reported with valid: false and a reason rather than an error status.",
  request: { params: invitationParam },
  responses: {
    200: jsonResponse("Invitation details", invitationDetailsSchema),
  },
});

const createInvitationRoute = createRoute({
  method: "post",
  operationId: "createInvitation",
  path: "/",
  tags: ["Invitations"],
  summary: "Invite a member with a scoped access bundle",
  description:
    "Invites an email with a scope: manual workspace/project grants and/or access teams. The caller must administer every workspace in the resulting scope. Acceptance materialises the scoped memberships and direct grants; teams stay live.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createInvitationBody } },
    },
  },
  responses: {
    200: jsonResponse("Created invitation", createdInvitationSchema),
    400: errorResponse("Invalid email, scope or teams"),
    403: errorResponse("Not allowed to manage one of the workspaces"),
  },
});

const invitation = apiRouter()
  .openapi(createInvitationRoute, async (c) => {
    const body = c.req.valid("json");
    return c.json(
      await createInvitation(
        c.get("userId") as string,
        {
          email: body.email,
          role: body.role,
          workspaces: body.workspaces ?? [],
          teamIds: body.teamIds ?? [],
        },
        c.req.raw.headers,
      ),
      200,
    );
  })
  .openapi(getPendingRoute, async (c) => {
    const user = c.get("user");
    if (!user?.emailVerified) {
      return c.json([], 200);
    }
    return c.json(await getUserPendingInvitations(c.get("userEmail")), 200);
  })
  .openapi(getInvitationRoute, async (c) =>
    c.json(await getInvitationDetailsController(c.req.valid("param").id), 200),
  );

export default invitation;
