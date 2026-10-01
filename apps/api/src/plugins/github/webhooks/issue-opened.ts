import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  columnTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../../database/schema";
import { publishEvent } from "../../../events";
import { claimTaskNumber } from "../../../task/controllers/claim-task-numbers";
import type { GitHubConfig } from "../config";
import { createExternalLink, findExternalLink } from "../services/link-manager";
import { findAllIntegrationsByRepo } from "../services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../utils/format";
import { getGithubApp } from "../utils/github-app";
import { addLabelsToIssue } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";

type IssueOpenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels?: Array<string | { name?: string }>;
    user: { login: string } | null;
  };
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueOpened(payload: IssueOpenedPayload) {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const { issue, repository } = payload;

  const appName = process.env.GITHUB_APP_NAME;
  if (appName && issue.user?.login === `${appName}[bot]`) {
    console.log(
      `Issue #${issue.number} was created by the configured GitHub App, skipping task creation`,
    );
    return;
  }

  const integrations = await findAllIntegrationsByRepo({
    owner: repository.owner.login,
    repo: repository.name,
  });

  if (integrations.length === 0) {
    return;
  }

  for (const integration of integrations) {
    const config = JSON.parse(integration.config) as GitHubConfig;
    const projectId = integration.projectId;

    const priority = extractIssuePriority(issue.labels);
    const status = extractIssueStatus(issue.labels);

    // One statement boundary for the link check and both writes. The webhook
    // and a resumable import reach this point concurrently; without it both see
    // no link and each create a task for the same issue.
    const createdTask = await db.transaction(async (tx) => {
      // The same integration row the import locks, so the two paths serialise.
      const [current] = await tx
        .select()
        .from(integrationTable)
        .where(eq(integrationTable.id, integration.id));
      if (!current?.isActive || current.config !== integration.config)
        return null;

      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.number.toString(),
        tx,
      );
      if (existingLink) return null;

      const targetStatus = await resolveTargetStatus(
        projectId,
        "issue_opened",
        status || "to-do",
        tx,
      );
      const targetColumn = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, targetStatus),
        ),
      });
      const number = await claimTaskNumber(projectId, tx);

      const [task] = await tx
        .insert(taskTable)
        .values({
          projectId,
          userId: null,
          title: issue.title,
          description: formatTaskDescriptionFromIssue(issue.body),
          status: targetStatus,
          columnId: targetColumn?.id ?? null,
          priority: priority ?? "low",
          number,
        })
        .returning();
      if (!task) throw new Error("Failed to create task from GitHub issue");

      await createExternalLink(
        {
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "issue",
          externalId: issue.number.toString(),
          url: issue.html_url,
          title: issue.title,
          metadata: {
            state: "open",
            createdFrom: "github",
            author: issue.user?.login,
          },
        },
        tx,
      );
      return task;
    });

    if (!createdTask) continue;

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "github",
      externalId: issue.number.toString(),
      actor: issue.user?.login ?? "github-webhook",
    });

    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!project) {
      console.error("Project not found for task linking comment");
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${project.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${project.slug.toUpperCase()}-${createdTask.number}`;

    try {
      let installationId = config.installationId;
      if (!installationId) {
        const { data: installation } =
          await githubApp.octokit.rest.apps.getRepoInstallation({
            owner: repository.owner.login,
            repo: repository.name,
          });
        installationId = installation.id;
      }

      const octokit = await githubApp.getInstallationOctokit(installationId);

      const existingLabels =
        issue.labels
          ?.map((label) => (typeof label === "string" ? label : label.name))
          .filter(Boolean) || [];

      const labelsToAdd: string[] = [];

      if (priority && !existingLabels.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }

      if (status && !existingLabels.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }

      if (labelsToAdd.length > 0) {
        await addLabelsToIssue(
          octokit,
          repository.owner.login,
          repository.name,
          issue.number,
          labelsToAdd,
        );
      }

      if (config.commentTaskLinkOnGitHubIssue !== false) {
        await octokit.rest.issues.createComment({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: issue.number,
          body: `[${taskIdentifier}](${taskUrl})`,
        });
      }
    } catch (error) {
      console.error("Failed to process GitHub issue:", error);
    }
  }
}
