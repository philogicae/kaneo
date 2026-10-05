import { client } from "@kaneo/libs";

async function deleteAccessTeam(id: string) {
  const response = await client["access-team"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteAccessTeam;
