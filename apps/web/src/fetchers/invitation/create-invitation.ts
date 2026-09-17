import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateInvitationRequest = InferRequestType<
  (typeof client)["invitation"]["$post"]
>["json"];

async function createInvitation(body: CreateInvitationRequest) {
  const response = await client.invitation.$post({ json: body });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createInvitation;
