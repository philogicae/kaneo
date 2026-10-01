import { client } from "@kaneo/libs";

async function getWorkspaceMembers(workspaceId: string) {
  const response = await client.workspace[":workspaceId"].members.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export type WorkspaceMember = Awaited<
  ReturnType<typeof getWorkspaceMembers>
>[number];

export default getWorkspaceMembers;
