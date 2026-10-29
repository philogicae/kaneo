import { type BoardGroupBy, isBoardGroupBy } from "@/lib/group-tasks";
import { useStoredState } from "./use-stored-state";

function normalizeGroupBy(raw: unknown): BoardGroupBy {
  return typeof raw === "string" && isBoardGroupBy(raw) ? raw : "none";
}

export function useBoardGrouping(projectId: string | undefined) {
  const [groupBy, setGroupBy] = useStoredState(
    projectId ? `kaneo:board-grouping:${projectId}` : null,
    normalizeGroupBy,
    "none",
  );

  return { groupBy, setGroupBy };
}
