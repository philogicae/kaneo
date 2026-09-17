import type { authClient } from "@/lib/auth-client";

export type WorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listMembers>>["data"]
>[number];

// Active workspace member (current user's membership)
export type ActiveWorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.getActiveMember>>["data"]
>;

// Workspace invitation types
export type WorkspaceUserInvitation = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listInvitations>>["data"]
>[number];

// Shape shared by the workspace member list and the project-scoped member
// list, so assignee and mention pickers can swap sources unchanged.
export type WorkspaceUserOption = {
  userId: string;
  role?: string;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

export type WorkspaceUsersPayload = {
  members: WorkspaceUserOption[];
  total?: number;
};

export type UserInvitation = NonNullable<
  Awaited<
    ReturnType<typeof authClient.organization.listUserInvitations>
  >["data"]
>[number];

export default WorkspaceUser;
