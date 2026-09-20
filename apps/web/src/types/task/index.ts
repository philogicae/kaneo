type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type TaskCustomFieldValue = {
  fieldId: string;
  value: string | null;
};

type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  status: string;
  // Roadmap sprint/phase the task belongs to, when assigned.
  milestoneId?: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  // Minutes before the task's start date at which Telegram reminders fire.
  reminderOffsets?: number[] | null;
  // Calendar-like recurrence; the next occurrence is spawned on completion.
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
  } | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  columnId?: string | null;
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
  customFieldValues?: TaskCustomFieldValue[];
};

export default Task;
