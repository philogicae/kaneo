import type Task from "@/types/task";

// Shared text matching for task search fields: title, description, task
// number, "<slug>-<number>" and "#<number>" identifiers. The query is
// assumed already trimmed/lowercased by the caller.
export function taskMatchesTextQuery(
  task: Pick<Task, "title" | "description" | "number">,
  normalizedQuery: string,
  projectSlug?: string,
) {
  const title = task.title?.toLowerCase() ?? "";
  const description = task.description?.toLowerCase() ?? "";
  const taskNumber = task.number?.toString() ?? "";
  const taskIdentifier =
    taskNumber && projectSlug
      ? `${projectSlug}-${taskNumber}`.toLowerCase()
      : "";
  const taskShortIdentifier = taskNumber ? `#${taskNumber}` : "";

  return (
    title.includes(normalizedQuery) ||
    description.includes(normalizedQuery) ||
    taskNumber.includes(normalizedQuery) ||
    taskIdentifier.startsWith(normalizedQuery) ||
    taskShortIdentifier.startsWith(normalizedQuery)
  );
}
