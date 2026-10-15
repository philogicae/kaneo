import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type AccessTeamScopeInput = InferRequestType<
  (typeof client)["access-team"]["$post"]
>["json"];

async function createAccessTeam(body: AccessTeamScopeInput) {
  const response = await client["access-team"].$post({ json: body });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createAccessTeam;
