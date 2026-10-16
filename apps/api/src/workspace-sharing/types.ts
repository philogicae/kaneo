export type WorkspaceInviteLink = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  token: string;
  role: string;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
};

export type WorkspaceInviteLinkCreated = WorkspaceInviteLink;

export type WorkspaceInviteLinkAcceptResult = {
  workspaceId: string;
  workspaceName: string;
  role: string;
};
