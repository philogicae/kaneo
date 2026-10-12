import { client } from "@kaneo/libs";
import type Appointment from "@/types/appointment";

async function getAppointments(projectId: string) {
  const response = await client.appointment.$get({
    query: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as Appointment[];
}

export default getAppointments;
