import { client } from "@kaneo/libs";

async function getMemberAccess(workspaceId: string, userId: string) {
  const response = await client.workspace[":workspaceId"].members[
    ":userId"
  ].access.$get({ param: { workspaceId, userId } });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export type MemberAccess = Awaited<ReturnType<typeof getMemberAccess>>;

export default getMemberAccess;
