import { client } from "@kaneo/libs";

type UpdateMilestoneInput = {
  id: string;
  name: string;
  color: string;
  description?: string | null;
};

async function updateMilestone(input: UpdateMilestoneInput) {
  const { id, ...json } = input;
  const response = await client.milestone[":id"].$put({
    param: { id },
    json,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateMilestone;
