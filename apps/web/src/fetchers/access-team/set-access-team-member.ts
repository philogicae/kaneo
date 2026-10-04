import { client } from "@kaneo/libs";

async function setAccessTeamMember(
  id: string,
  userId: string,
  action: "add" | "remove",
) {
  const response =
    action === "add"
      ? await client["access-team"][":id"].members.$post({
          param: { id },
          json: { userId },
        })
      : await client["access-team"][":id"].members[":userId"].$delete({
          param: { id, userId },
        });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default setAccessTeamMember;
