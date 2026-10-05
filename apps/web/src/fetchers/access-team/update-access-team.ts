import { client } from "@kaneo/libs";
import type { AccessTeamScopeInput } from "./create-access-team";

async function updateAccessTeam(id: string, body: AccessTeamScopeInput) {
  const response = await client["access-team"][":id"].$put({
    param: { id },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateAccessTeam;
