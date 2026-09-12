import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateWorkspaceInviteLinkRequest = InferRequestType<
  (typeof client)["workspace-sharing"]["$post"]
>["json"];

export async function createWorkspaceInviteLink(
  body: CreateWorkspaceInviteLinkRequest,
) {
  const response = await client["workspace-sharing"].$post({
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}
