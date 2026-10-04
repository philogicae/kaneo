import { teamWorkspaceScope } from "../access-team/schema";
import { z } from "../openapi";

export const invitationParam = z.object({ id: z.string() });

export const createInvitationBody = z.object({
  email: z.string().openapi({ description: "Invitee email address." }),
  role: z.string().optional().openapi({
    description:
      'Workspace role granted in the primary workspace (default "member"). Custom workspace roles are accepted.',
  }),
  workspaces: z.array(teamWorkspaceScope).optional().openapi({
    description:
      "Manual workspace/project grants, used when no team is selected.",
  }),
  teamIds: z.array(z.string()).optional().openapi({
    description:
      "Access teams whose scope the invitee joins; teams stay live after acceptance.",
  }),
});
