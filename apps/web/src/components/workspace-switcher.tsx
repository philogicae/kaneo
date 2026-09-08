import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import NotificationDropdown from "@/components/notification/notification-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import { shortcuts } from "@/constants/shortcuts";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import {
  getModifierKeyText,
  useRegisterShortcuts,
} from "@/hooks/use-keyboard-shortcuts";
import { useUserWebSocket } from "@/hooks/use-user-websocket";
import { authClient } from "@/lib/auth-client";
import {
  isWorkspaceSortMode,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import type { Workspace } from "@/types/workspace";
import CreateWorkspaceModal from "./shared/modals/create-workspace-modal";

// Same drag contract as the project list: a small pointer distance turns a
// click into a drag, touch needs a hold. Only active in custom sort mode.
function SortableWorkspaceItem({
  id,
  canReorder,
  children,
}: {
  id: string;
  canReorder: boolean;
  children: React.ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      disabled: !canReorder,
      animateLayoutChanges: () => false,
      transition: { duration: 200, easing: "var(--ease-out)" },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-0" : undefined}
      {...(canReorder ? listeners : {})}
    >
      {children}
    </li>
  );
}

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();

  // User-scoped WebSocket for real-time events (e.g. NOTIFICATION_CREATED)
  useUserWebSocket();
  const { data: workspaces } = useGetWorkspaces();
  const { data: session } = authClient.useSession();
  const { data: config } = useGetConfig();
  const isAdmin = session?.user?.role === "admin";
  const canCreateWorkspace =
    isAdmin || (config !== undefined && !config.disableWorkspaceCreation);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    React.useState(false);
  const [isSwitching, setIsSwitching] = React.useState(false);

  const { workspaceSort, setWorkspaceSort, workspaceOrder, setWorkspaceOrder } =
    useUserPreferencesStore();

  // Alphabetical by name by default; "date" is newest first; "custom" follows
  // the persisted drag & drop order (unknown workspaces appended).
  const sortedWorkspaces = React.useMemo(() => {
    if (!workspaces) return undefined;
    if (workspaceSort === "name") {
      return [...workspaces].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }
    if (workspaceSort === "date") {
      return [...workspaces].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
    }
    const rank = new Map(workspaceOrder.map((id, index) => [id, index]));
    return [...workspaces].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (rank.get(b.id) ?? Number.POSITIVE_INFINITY),
    );
  }, [workspaces, workspaceSort, workspaceOrder]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !sortedWorkspaces) return;

    const oldIndex = sortedWorkspaces.findIndex((ws) => ws.id === active.id);
    const newIndex = sortedWorkspaces.findIndex((ws) => ws.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedWorkspaces, oldIndex, newIndex);
    setWorkspaceOrder(reordered.map((ws) => ws.id));
  };

  const handleWorkspaceChange = React.useCallback(
    async (selectedWorkspace: Workspace) => {
      if (isSwitching) return;

      setIsSwitching(true);
      try {
        await authClient.organization.setActive({
          organizationId: selectedWorkspace.id,
        });

        setTimeout(() => {
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: { workspaceId: selectedWorkspace.id },
          });
        }, 50);
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      } finally {
        setTimeout(() => setIsSwitching(false), 100);
      }
    },
    [navigate, isSwitching],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!workspaces || workspaces.length === 0) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= "1" &&
        event.key <= "9"
      ) {
        event.preventDefault();
        const index = Number.parseInt(event.key, 10) - 1;
        if (index < workspaces.length) {
          handleWorkspaceChange(workspaces[index]);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, workspaces, handleWorkspaceChange]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.workspace.prefix]: {
        [shortcuts.workspace.switch]: () => {
          setIsOpen(true);
        },
        [shortcuts.workspace.create]: () => {
          if (canCreateWorkspace) {
            setIsCreateWorkspaceModalOpen(true);
          }
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between w-full gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="group min-h-8 h-auto w-full rounded-md px-2 py-1.5 text-sidebar-foreground data-[active=true]:bg-sidebar-accent/50"
                    size="default"
                  />
                }
              >
                <div className="flex items-start min-w-0 w-full">
                  {/* Never truncate the workspace name: it wraps instead. */}
                  <span
                    className={`whitespace-pre-wrap break-words text-left text-sm leading-tight font-medium text-foreground ${isSwitching ? "opacity-50" : ""}`}
                  >
                    {workspace.name}
                  </span>
                </div>
                <ChevronDown
                  className={`ml-1 mt-0.5 size-3.5 shrink-0 text-foreground/70 opacity-90 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:rotate-180 transition-[rotate,opacity] duration-200 ease-out ${isSwitching ? "animate-spin" : ""}`}
                  data-state={isOpen ? "open" : "closed"}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-(--anchor-width) text-sidebar-foreground"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <div className="flex items-center justify-between">
                    <DropdownMenuLabel>
                      {t("navigation:workspaceSwitcher.workspaces")}
                    </DropdownMenuLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label={t(
                              "navigation:workspaceSwitcher.sortWorkspaces",
                            )}
                            title={t(
                              "navigation:workspaceSwitcher.sortWorkspaces",
                            )}
                            className="mr-1 flex h-6 w-6 items-center justify-center rounded-lg text-sidebar-foreground/60 outline-hidden ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
                          />
                        }
                      >
                        <ArrowUpDown
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="min-w-44 rounded-lg"
                        align="end"
                      >
                        <DropdownMenuRadioGroup
                          value={workspaceSort}
                          onValueChange={(value) =>
                            isWorkspaceSortMode(value) &&
                            setWorkspaceSort(value)
                          }
                        >
                          <DropdownMenuRadioItem value="name">
                            {t("navigation:projectList.sortName")}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="date">
                            {t("navigation:projectList.sortDate")}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="custom">
                            {t("navigation:projectList.sortCustom")}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedWorkspaces?.map((ws) => ws.id) ?? []}
                    strategy={verticalListSortingStrategy}
                  >
                    {sortedWorkspaces?.map((ws: Workspace, index: number) => (
                      <SortableWorkspaceItem
                        key={ws.id}
                        id={ws.id}
                        canReorder={workspaceSort === "custom"}
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            if (!isSwitching && ws.id !== workspace.id) {
                              handleWorkspaceChange(ws);
                              setIsOpen(false);
                            }
                          }}
                          disabled={isSwitching || ws.id === workspace.id}
                          className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                        >
                          <span className="flex-1 text-left">
                            {isSwitching && ws.id === workspace?.id
                              ? t("navigation:workspaceSwitcher.switching")
                              : ws.name}
                          </span>
                          <DropdownMenuShortcut>
                            {getModifierKeyText()} {index > 8 ? "0" : index + 1}
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </SortableWorkspaceItem>
                    ))}
                  </SortableContext>
                </DndContext>

                {canCreateWorkspace && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setIsCreateWorkspaceModalOpen(true);
                        setIsOpen(false);
                      }}
                      className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                    >
                      <span>
                        {t("navigation:workspaceSwitcher.addWorkspace")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-1">
          <NotificationDropdown />
          <div className="h-8 w-8 shrink-0">
            <UserAvatar />
          </div>
        </div>
      </div>

      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />
    </>
  );
}
