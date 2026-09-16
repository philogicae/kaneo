type Appointment = {
  id: string;
  projectId: string;
  position: number | null;
  number: number | null;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  title: string;
  description: string | null;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  reminderOffsets: number[] | null;
  recurrence: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
  } | null;
  createdAt: string;
};

export default Appointment;
