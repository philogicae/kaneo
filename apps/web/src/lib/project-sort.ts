import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import type { ProjectSortMode } from "@/store/user-preferences";

type ProjectListItem = InferResponseType<
  (typeof client)["project"]["$get"],
  200
>[number];

// Shared sorting for the dashboard and the sidebar: alphabetical by name by
// default, stored custom order only applies when explicitly picked.
function byNameDesc(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortProjects(
  projects: ProjectListItem[],
  mode: ProjectSortMode,
): ProjectListItem[] {
  if (mode === "name") {
    return [...projects].sort((a, b) => byNameDesc(a.name, b.name));
  }
  if (mode === "date") {
    return [...projects].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
  }
  if (mode === "completion") {
    return [...projects].sort(
      (a, b) =>
        (b.statistics?.completionPercentage ?? -1) -
        (a.statistics?.completionPercentage ?? -1),
    );
  }
  return projects;
}

export type { ProjectListItem };
export { byNameDesc, sortProjects };
