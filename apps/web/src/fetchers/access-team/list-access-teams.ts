import { client } from "@kaneo/libs";

async function listAccessTeams(workspaceId?: string) {
  const response = await client["access-team"].$get({
    query: workspaceId ? { workspaceId } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export type AccessTeam = NonNullable<
  Awaited<ReturnType<typeof listAccessTeams>>
>[number];

export default listAccessTeams;
