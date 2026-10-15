export type WorkspaceScopeSelection = {
  allProjects: boolean;
  projectIds: Set<string>;
};

export type AccessScopeValue = Record<
  string,
  WorkspaceScopeSelection | undefined
>;

export function toggleScopeWorkspace(
  value: AccessScopeValue,
  workspaceId: string,
  selected: boolean,
): AccessScopeValue {
  const next = { ...value };
  if (selected) {
    next[workspaceId] = { allProjects: true, projectIds: new Set() };
  } else {
    delete next[workspaceId];
  }
  return next;
}

export function setScopeAllProjects(
  value: AccessScopeValue,
  workspaceId: string,
  allProjects: boolean,
): AccessScopeValue {
  const current = value[workspaceId];
  if (!current) return value;
  return {
    ...value,
    [workspaceId]: { allProjects, projectIds: current.projectIds },
  };
}

export function toggleScopeProject(
  value: AccessScopeValue,
  workspaceId: string,
  projectId: string,
  selected: boolean,
): AccessScopeValue {
  const current = value[workspaceId];
  if (!current) return value;
  const projectIds = new Set(current.projectIds);
  if (selected) {
    projectIds.add(projectId);
  } else {
    projectIds.delete(projectId);
  }
  return { ...value, [workspaceId]: { ...current, projectIds } };
}

// A workspace selected with neither "all projects" nor an explicit project
// would grant nothing; the API rejects it, so the save button stays disabled.
export function isScopeValid(value: AccessScopeValue): boolean {
  const selections = Object.values(value).filter(
    (selection): selection is WorkspaceScopeSelection => Boolean(selection),
  );
  if (selections.length === 0) return false;
  return selections.every(
    (selection) => selection.allProjects || selection.projectIds.size > 0,
  );
}

export function toScopeInput(value: AccessScopeValue): Array<{
  workspaceId: string;
  allProjects: boolean;
  projectIds: string[];
}> {
  return Object.entries(value)
    .filter((entry): entry is [string, WorkspaceScopeSelection] =>
      Boolean(entry[1]),
    )
    .map(([workspaceId, selection]) => ({
      workspaceId,
      allProjects: selection.allProjects,
      projectIds: selection.allProjects ? [] : [...selection.projectIds],
    }));
}

export function scopeFromTeam(
  workspaces: Array<{
    workspaceId: string;
    allProjects: boolean;
    projects: Array<{ id: string }>;
  }>,
): AccessScopeValue {
  const value: AccessScopeValue = {};
  for (const workspace of workspaces) {
    value[workspace.workspaceId] = {
      allProjects: workspace.allProjects,
      projectIds: new Set(
        workspace.allProjects ? [] : workspace.projects.map(({ id }) => id),
      ),
    };
  }
  return value;
}
