import { useEffect, useState } from "react";
import { type BoardGroupBy, isBoardGroupBy } from "@/lib/group-tasks";

export function useBoardGrouping(projectId: string | undefined) {
  const storageKey = projectId ? `kaneo:board-grouping:${projectId}` : null;
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("none");
  // StrictMode remounts effects on the first commit, so the write effect
  // would otherwise clobber the stored value with the default before the
  // read effect restored it. Writing only starts after hydration.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) {
        setGroupBy("none");
      } else {
        setGroupBy(isBoardGroupBy(stored) ? stored : "none");
      }
    } catch {
      setGroupBy("none");
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, groupBy);
    } catch {
      // persistence is best-effort; private mode or quota can block writes
    }
  }, [groupBy, storageKey, hydrated]);

  return { groupBy, setGroupBy };
}
