import { getApiUrl } from "@/fetchers/get-api-url";

export type WorkspaceInviteLinkPublicDetails = {
  valid: boolean;
  workspaceName?: string;
  createdAt?: string;
  error?: string;
};

export async function getWorkspaceInviteLinkDetails(token: string) {
  const response = await fetch(
    getApiUrl(`/workspace-sharing/public/${encodeURIComponent(token)}`),
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as WorkspaceInviteLinkPublicDetails;
}

export default getWorkspaceInviteLinkDetails;
