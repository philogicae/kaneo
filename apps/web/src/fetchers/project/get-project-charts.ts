import { client } from "@kaneo/libs";

type ProjectChartsBucket = {
  weekStart: string;
  created: number;
  completed: number;
};

export type { ProjectChartsBucket };

async function getProjectCharts(projectId: string) {
  const response = await client.project[":id"].charts.$get({
    param: { id: projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as ProjectChartsBucket[];
}

export default getProjectCharts;
