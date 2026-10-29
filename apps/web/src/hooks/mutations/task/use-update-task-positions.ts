import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import updateTask from "@/fetchers/task/update-task";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type UpdateTaskPositions = {
  projectId: string;
  tasks: Task[];
};

// A drop rewrites every position in the source and destination columns. Sending
// them one at a time keeps SQLite writes serialized, and invalidating once at
// the end avoids the refetch storm the per-task mutation caused mid-drag.
export function useUpdateTaskPositions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  // A fast second drop must not overtake the first one's writes.
  const writes = useRef<Promise<void>>(Promise.resolve());

  return useMutation({
    mutationFn: ({ tasks }: UpdateTaskPositions) => {
      const run = writes.current.then(async () => {
        for (const task of tasks) {
          await updateTask(task.id, task);
        }
      });
      writes.current = run.catch(() => {});
      return run;
    },
    onSuccess: (_, { projectId }) => {
      invalidateMyWork(queryClient);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error, { projectId }) => {
      // The board was moved optimistically; drop it back to the server state.
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.error(
        error instanceof Error ? error.message : t("tasks:board.reorderFailed"),
      );
    },
  });
}
