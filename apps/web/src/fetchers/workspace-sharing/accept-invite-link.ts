import { getApiUrl } from "@/fetchers/get-api-url";

export type AcceptWorkspaceInviteLinkResponse = {
  workspaceId: string;
  workspaceName: string;
  role: string;
};

export async function acceptWorkspaceInviteLink(token: string) {
  const response = await fetch(
    getApiUrl(`/workspace-sharing/public/${encodeURIComponent(token)}/accept`),
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as AcceptWorkspaceInviteLinkResponse;
}
