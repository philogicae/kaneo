// Jev stage of the global search: the SQL pass is recall (a permissive LIKE
// match), so when a TypeSafe key is configured the over-fetched candidates
// are scored by Jev against the query and only the relevant ones survive,
// best first. Without a key, or on any failure, the previous results are
// returned unchanged.

import { envFlag } from "../jev/budget";
import { askJev, isJevEnabled, type JevAsker } from "../jev/client";
import { CANDIDATE_CAP, rerankByRelevance } from "../jev/rerank";

// Exact short-id matches are authoritative; they stay on top and are never
// sent to Jev.
const SHORT_ID_SCORE = 10;

export type JevSearchResult = {
  id: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  projectName?: string;
  projectSlug?: string;
  workspaceName?: string;
  taskNumber?: number;
  relevanceScore: number;
};

export function searchResultText(result: JevSearchResult): string {
  const parts = [`type: ${result.type}`, `title: ${result.title}`];
  if (result.description) {
    parts.push(`description: ${result.description}`);
  }
  if (result.content) {
    parts.push(`content: ${result.content}`);
  }
  if (result.projectName) {
    parts.push(
      `project: ${result.projectName}${result.projectSlug ? ` (${result.projectSlug})` : ""}`,
    );
  }
  if (result.workspaceName) {
    parts.push(`workspace: ${result.workspaceName}`);
  }
  if (result.taskNumber) {
    parts.push(`task: ${result.projectSlug ?? "?"}-${result.taskNumber}`);
  }
  return parts.join("\n");
}

export async function rerankSearchResults<T extends JevSearchResult>(
  results: T[],
  query: string,
  limit: number,
  ask?: JevAsker,
): Promise<{ results: T[]; totalCount: number }> {
  const fallback = {
    results: results.slice(0, limit),
    totalCount: results.length,
  };
  if (results.length <= 1 || (!ask && !isJevEnabled())) {
    return fallback;
  }

  const asker = ask ?? askJev;
  const pinned = results.filter(
    (result) => result.relevanceScore >= SHORT_ID_SCORE,
  );
  const candidates = results
    .filter((result) => result.relevanceScore < SHORT_ID_SCORE)
    .slice(0, CANDIDATE_CAP);

  const kept = await rerankByRelevance({
    query,
    items: candidates,
    topk: Math.max(limit - pinned.length, 0),
    textOf: searchResultText,
    kind: "search results",
    ask: asker,
    // The SQL pass already matched the query text; returning nothing because
    // Jev was not confident is worse than returning the maybe-relevant rows
    // the user used to get. Unsure rejects fill the places the sure ones
    // leave (KANEO_JEV_KEEP_UNSURE=0 restores the hard floor).
    keepUnsure: envFlag("KANEO_JEV_KEEP_UNSURE", true),
  });
  if (kept === null) {
    return fallback;
  }

  return {
    results: [...pinned, ...kept].slice(0, limit),
    totalCount: pinned.length + kept.length,
  };
}
