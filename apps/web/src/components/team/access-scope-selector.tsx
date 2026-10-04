import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import type { ManageableWorkspace } from "@/fetchers/access-team/list-manageable-workspaces";
import {
  type AccessScopeValue,
  setScopeAllProjects,
  toggleScopeProject,
  toggleScopeWorkspace,
} from "@/lib/access-scope";

type Props = {
  workspaces: ManageableWorkspace[];
  value: AccessScopeValue;
  onChange: (value: AccessScopeValue) => void;
  disabled?: boolean;
};

// Workspace tree selector mirroring the Telegram rule editor: pick workspaces,
// then either every project or an explicit list.
export default function AccessScopeSelector({
  workspaces,
  value,
  onChange,
  disabled,
}: Props) {
  const { t } = useTranslation();

  if (workspaces.length === 0) {
    return (
      <p className="rounded-md border border-border/50 p-2 text-xs text-muted-foreground">
        {t("team:accessScope.noWorkspaces")}
      </p>
    );
  }

  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/50 p-2">
      {workspaces.map((workspace) => {
        const selection = value[workspace.id];
        return (
          <div key={workspace.id}>
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor={`access-scope-workspace-${workspace.id}`}
            >
              <Checkbox
                id={`access-scope-workspace-${workspace.id}`}
                checked={Boolean(selection)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    toggleScopeWorkspace(value, workspace.id, checked === true),
                  )
                }
              />
              <span className="truncate">{workspace.name}</span>
            </label>

            {selection && (
              <div className="mt-1 space-y-1 pl-6">
                <label
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  htmlFor={`access-scope-all-projects-${workspace.id}`}
                >
                  <Checkbox
                    id={`access-scope-all-projects-${workspace.id}`}
                    checked={selection.allProjects}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onChange(
                        setScopeAllProjects(
                          value,
                          workspace.id,
                          checked === true,
                        ),
                      )
                    }
                  />
                  {t("team:accessScope.allProjects")}
                </label>

                {!selection.allProjects && (
                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {workspace.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("team:accessScope.noProjects")}
                      </p>
                    ) : (
                      workspace.projects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-center gap-2 text-xs"
                          htmlFor={`access-scope-project-${project.id}`}
                        >
                          <Checkbox
                            id={`access-scope-project-${project.id}`}
                            checked={selection.projectIds.has(project.id)}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              onChange(
                                toggleScopeProject(
                                  value,
                                  workspace.id,
                                  project.id,
                                  checked === true,
                                ),
                              )
                            }
                          />
                          <span className="truncate">{project.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
