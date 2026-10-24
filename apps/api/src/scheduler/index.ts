import { Cron } from "croner";
import { replayDeferredIssueEdits } from "../plugins/github/services/deferred-issue-edits";
import { replayDeferredLabelFields } from "../plugins/sync/replay-deferred-label-fields";
import { checkAppointmentRecurrence } from "./appointment-recurrence";
import { checkAppointmentReminders } from "./appointment-reminders";
import { checkDueDateReminders } from "./due-date-reminders";
import { checkProjectWebhookReminders } from "./project-webhook-reminders";
import { checkTelegramTaskReminders } from "./telegram-task-reminders";

const jobs: Cron[] = [];

type JobOutcome = { degraded?: boolean };

// Cron jobs swallow their operational failures (per-item try/catch) so they
// can keep processing the rest of the batch. A returned degraded outcome is
// logged, and unexpected throws are logged and swallowed so one bad tick
// can't take down the scheduler via an unhandled rejection.
function withCheckIn<T>(name: string, fn: () => Promise<T>) {
  return async (): Promise<void> => {
    try {
      const result = await fn();
      const degraded = Boolean(
        (result as JobOutcome | null | undefined)?.degraded,
      );
      if (degraded) {
        console.error(`Cron job ${name} finished degraded`);
      }
    } catch (error) {
      console.error(`Cron job ${name} failed`, error);
    }
  };
}

export function initializeScheduler(): void {
  jobs.push(
    new Cron(
      "* * * * *",
      { protect: true },
      withCheckIn("deferred-issue-edits", replayDeferredIssueEdits),
    ),
  );
  jobs.push(
    new Cron(
      "* * * * *",
      { protect: true },
      withCheckIn("deferred-label-fields", replayDeferredLabelFields),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("due-date-reminders", checkDueDateReminders),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("project-webhook-reminders", checkProjectWebhookReminders),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("telegram-task-reminders", checkTelegramTaskReminders),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("appointment-reminders", checkAppointmentReminders),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("appointment-recurrence", checkAppointmentRecurrence),
    ),
  );
  console.log(
    "⏰ Scheduler started (deferred integration edits every minute, reminders every 5 minutes)",
  );
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
