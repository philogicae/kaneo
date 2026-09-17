import { client } from "@kaneo/libs";

type MemberAccessInput = {
  allProjects: boolean;
  projectIds: string[];
};

async function updateMemberAccess(
  workspaceId: string,
  userId: string,
  access: MemberAccessInput,
) {
  const response = await client.workspace[":workspaceId"].members[
    ":userId"
  ].access.$put({ param: { workspaceId, userId }, json: access });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateMemberAccess;
