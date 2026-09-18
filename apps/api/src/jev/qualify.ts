// Jev qualification for task creation: one Choice question decides the
// priority and one Noul question per candidate label decides the semantic
// tags. The creator's pre-filled priority travels as a hint, not as an
// answer. Fail-open: null means the caller keeps its previous values.
//
// Context safety mirrors the reference reranker: the state is capped, and the
// questions are split into budget-fitting batches that run in parallel (the
// API allows 64k tokens per request and 32k for the state plus the longest
// question). An oversized label question is skipped instead of sinking the
// whole qualification.
//
// Labels named `branch:*` or `machine:*` are never suggested: those encode
// the working context, not the task's nature.

import {
  baseRequestTokens,
  envRatio,
  estimateJevTokens,
  resolvedMaxRequestTokens,
  splitByBudget,
} from "./budget";
import {
  askJev,
  isJevEnabled,
  type JevAnswers,
  type JevAsker,
  type JevQuestion,
} from "./client";

const DEFAULT_LABEL_THRESHOLD = 0.5;
const MAX_LABEL_CANDIDATES = 64;
const DESCRIPTION_CHARS = 8_000;

export const AUTO_LABEL_PREFIXES = ["branch:", "machine:"];

// The priority scale Jev chooses from. Criteria describe situations, not
// degrees.
export const PRIORITY_CRITERIA: Record<string, string> = {
  "no-priority": "No urgency or special importance; do it when convenient.",
  low: "Nice to have; it can wait.",
  medium: "Normal work; it should be done in the usual flow.",
  high: "Important; it takes precedence over routine work.",
  urgent: "Blocking or time-critical; it must be handled immediately.",
};

export function isSemanticLabel(name: string) {
  const normalized = name.trim().toLowerCase();
  return !AUTO_LABEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export type QualificationLabel = {
  id: string;
  name: string;
  color: string;
};

export type SuggestedLabel = QualificationLabel & { probability: number };

export type TaskQualification = {
  priority: string;
  priorityConfidence: number | null;
  labels: SuggestedLabel[];
};

export type QualifyInput = {
  title: string;
  description?: string;
  projectName?: string;
  workspaceName?: string;
  labels: QualificationLabel[];
  providedPriority?: string;
  ask?: JevAsker;
  labelThreshold?: number;
  maxRequestTokens?: number;
};

type QuestionEntry = {
  name: string;
  question: JevQuestion;
  tokens: number;
};

function questionEntry(name: string, question: JevQuestion): QuestionEntry {
  return {
    name,
    question,
    tokens: estimateJevTokens(JSON.stringify({ [name]: question })),
  };
}

function resolvedLabelThreshold(value: number | undefined) {
  return (
    value ?? envRatio("KANEO_JEV_LABEL_THRESHOLD", DEFAULT_LABEL_THRESHOLD)
  );
}

function priorityHint(providedPriority: string | undefined) {
  const value = providedPriority?.trim();
  if (!value || value === "no-priority" || !(value in PRIORITY_CRITERIA)) {
    return "The creator left the priority unset.";
  }
  return `The creator pre-filled the priority "${value}" (it may be wrong).`;
}

function fallbackPriority(providedPriority: string | undefined) {
  const value = providedPriority?.trim();
  return value && value in PRIORITY_CRITERIA ? value : "no-priority";
}

export async function suggestTaskQualification(
  input: QualifyInput,
): Promise<TaskQualification | null> {
  if (!input.ask && !isJevEnabled()) {
    return null;
  }
  const asker = input.ask ?? askJev;
  const labels = input.labels
    .filter((label) => isSemanticLabel(label.name))
    .slice(0, MAX_LABEL_CANDIDATES);

  const contextParts = [
    input.projectName ? `project "${input.projectName}"` : null,
    input.workspaceName ? `workspace "${input.workspaceName}"` : null,
  ].filter(Boolean);

  const state = {
    task: {
      title: input.title,
      description: (input.description ?? "").slice(0, DESCRIPTION_CHARS),
    },
  };

  const priorityQuestion: JevQuestion = {
    type: "choice",
    instructions:
      "`task.title` and `task.description` describe a task being filed" +
      (contextParts.length > 0 ? ` in ${contextParts.join(", ")}` : "") +
      `. ${priorityHint(input.providedPriority)} Which priority should the ` +
      "task get? Judge from the task's actual content.",
    criteria: PRIORITY_CRITERIA,
  };

  const maxRequestTokens = resolvedMaxRequestTokens(input.maxRequestTokens);
  const baseTokens = baseRequestTokens({ state, questions: {} });
  if (baseTokens >= maxRequestTokens) {
    console.warn(
      `[jev] task qualification skipped: state is ~${baseTokens} tokens, over the ${maxRequestTokens} budget`,
    );
    return null;
  }
  const budget = Math.max(1, maxRequestTokens - baseTokens);

  const entries: QuestionEntry[] = [
    questionEntry("priority", priorityQuestion),
  ];
  labels.forEach((label, index) => {
    const entry = questionEntry(`label_${index}`, {
      type: "noul",
      instructions:
        "The task in `task.title` and `task.description` is being filed. " +
        `Should it carry the label "${label.name}"?`,
      criteria: {
        true: `The task clearly falls under "${label.name}".`,
        false: "The label does not describe this task.",
      },
    });
    if (entry.tokens > budget) {
      console.warn(`[jev] label question skipped (too large): ${label.name}`);
      return;
    }
    entries.push(entry);
  });

  let answers: JevAnswers;
  try {
    const batches = splitByBudget(entries, budget).map((batch) =>
      Object.fromEntries(batch.map((entry) => [entry.name, entry.question])),
    );
    const responses = await Promise.all(
      batches.map((questions) => asker(state, questions)),
    );
    answers = Object.assign({}, ...responses);
  } catch (error) {
    console.warn(
      `[jev] task qualification skipped: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return null;
  }

  const choice = answers.priority?.choice;
  const priority =
    typeof choice === "string" && choice in PRIORITY_CRITERIA
      ? choice
      : fallbackPriority(input.providedPriority);
  const confidence = answers.priority?.confidence;

  const threshold = resolvedLabelThreshold(input.labelThreshold);
  const suggested: SuggestedLabel[] = [];
  labels.forEach((label, index) => {
    const probability = answers[`label_${index}`]?.noul;
    if (typeof probability === "number" && probability >= threshold) {
      suggested.push({ ...label, probability });
    }
  });
  suggested.sort((a, b) => b.probability - a.probability);

  return {
    priority,
    priorityConfidence:
      typeof confidence === "number" && Number.isFinite(confidence)
        ? confidence
        : null,
    labels: suggested,
  };
}
