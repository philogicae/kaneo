import { describe, expect, it } from "vitest";
import {
  isScopeValid,
  scopeFromTeam,
  setScopeAllProjects,
  toggleScopeProject,
  toggleScopeWorkspace,
  toScopeInput,
} from "./access-scope";

describe("toggleScopeWorkspace", () => {
  it("selects a workspace with all projects and clears it on deselect", () => {
    const selected = toggleScopeWorkspace({}, "ws-1", true);
    expect(selected["ws-1"]).toEqual({
      allProjects: true,
      projectIds: new Set(),
    });

    const cleared = toggleScopeWorkspace(selected, "ws-1", false);
    expect(cleared["ws-1"]).toBeUndefined();
    expect(Object.keys(cleared)).toHaveLength(0);
  });
});

describe("setScopeAllProjects and toggleScopeProject", () => {
  it("keeps explicit projects when narrowing to a selection", () => {
    let value = toggleScopeWorkspace({}, "ws-1", true);
    value = setScopeAllProjects(value, "ws-1", false);
    value = toggleScopeProject(value, "ws-1", "project-1", true);
    expect(value["ws-1"]).toEqual({
      allProjects: false,
      projectIds: new Set(["project-1"]),
    });

    value = toggleScopeProject(value, "ws-1", "project-1", false);
    expect(value["ws-1"]?.projectIds.size).toBe(0);
  });

  it("ignores toggles for a workspace that is not selected", () => {
    const value = toggleScopeProject({}, "ws-1", "project-1", true);
    expect(value["ws-1"]).toBeUndefined();
  });
});

describe("isScopeValid", () => {
  it("requires at least one workspace", () => {
    expect(isScopeValid({})).toBe(false);
  });

  it("rejects a workspace with no projects and no all-projects flag", () => {
    let value = toggleScopeWorkspace({}, "ws-1", true);
    value = setScopeAllProjects(value, "ws-1", false);
    expect(isScopeValid(value)).toBe(false);

    value = toggleScopeProject(value, "ws-1", "project-1", true);
    expect(isScopeValid(value)).toBe(true);
  });
});

describe("toScopeInput", () => {
  it("serialises selections and drops all-projects project lists", () => {
    let value = toggleScopeWorkspace({}, "ws-1", true);
    value = toggleScopeWorkspace(value, "ws-2", true);
    value = setScopeAllProjects(value, "ws-2", false);
    value = toggleScopeProject(value, "ws-2", "project-2", true);

    expect(toScopeInput(value)).toEqual([
      { workspaceId: "ws-1", allProjects: true, projectIds: [] },
      { workspaceId: "ws-2", allProjects: false, projectIds: ["project-2"] },
    ]);
  });
});

describe("scopeFromTeam", () => {
  it("rebuilds a selection from a serialised team scope", () => {
    const value = scopeFromTeam([
      {
        workspaceId: "ws-1",
        allProjects: false,
        projects: [{ id: "p-1" }, { id: "p-2" }],
      },
      { workspaceId: "ws-2", allProjects: true, projects: [] },
    ]);

    expect(value["ws-1"]).toEqual({
      allProjects: false,
      projectIds: new Set(["p-1", "p-2"]),
    });
    expect(value["ws-2"]).toEqual({
      allProjects: true,
      projectIds: new Set(),
    });
  });
});
