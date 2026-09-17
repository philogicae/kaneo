import { client } from "@kaneo/libs";

async function listManageableWorkspaces() {
  const response = await client["access-team"]["manageable-workspaces"].$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export type ManageableWorkspace = Awaited<
  ReturnType<typeof listManageableWorkspaces>
>[number];

export default listManageableWorkspaces;
