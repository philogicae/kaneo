import { client } from "@kaneo/libs";

async function deleteAppointment(id: string) {
  const response = await client.appointment[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default deleteAppointment;
