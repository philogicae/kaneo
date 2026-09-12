import { client } from "@kaneo/libs";

export type GetWorkspaceInviteLinksResponse = Array<{
  id: string;
  workspaceId: string;
  workspaceName: string;
  token: string;
  role: string;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
}>;

export async function getWorkspaceInviteLinks(workspaceId: string) {
  const response = await client["workspace-sharing"].$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as GetWorkspaceInviteLinksResponse;
}

export default getWorkspaceInviteLinks;
