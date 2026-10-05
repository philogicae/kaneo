import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteWorkspaceInviteLinkRequest = {
  workspaceId: string;
} & InferRequestType<
  (typeof client)["workspace-sharing"][":id"]["$delete"]
>["param"];

export async function deleteWorkspaceInviteLink({
  workspaceId,
  id,
}: DeleteWorkspaceInviteLinkRequest) {
  const response = await client["workspace-sharing"][":id"].$delete({
    param: { id },
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}
