import { client } from "@kaneo/libs";
import type { ChartRange } from "@/store/user-preferences";

type ProjectChartsBucket = {
  weekStart: string;
  created: number;
  completed: number;
};

export type { ProjectChartsBucket };

async function getProjectCharts(projectId: string, range: ChartRange) {
  const response = await client.project[":id"].charts.$get({
    param: { id: projectId },
    query: { range },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as ProjectChartsBucket[];
}

export default getProjectCharts;
