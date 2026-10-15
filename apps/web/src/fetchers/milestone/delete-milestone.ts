import { client } from "@kaneo/libs";

async function deleteMilestone(id: string) {
  const response = await client.milestone[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteMilestone;
