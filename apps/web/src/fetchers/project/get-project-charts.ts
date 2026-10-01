import { client } from "@kaneo/libs";
import type { ChartRange, ChartUnit } from "@/store/user-preferences";

type ProjectChartsBucket = {
  bucketStart: string;
  created: number;
  completed: number;
};

export type { ProjectChartsBucket };

async function getProjectCharts(
  projectId: string,
  range: ChartRange,
  unit: ChartUnit,
) {
  const response = await client.project[":id"].charts.$get({
    param: { id: projectId },
    query: { range, unit },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as ProjectChartsBucket[];
}

export default getProjectCharts;
