import { Group } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { BoardGroupBy } from "@/lib/group-tasks";

type GroupControlProps = {
  groupBy: BoardGroupBy;
  onGroupByChange: (groupBy: BoardGroupBy) => void;
};

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked ? "\u2713" : null}
    </span>
  );
}

export default function GroupControl({
  groupBy,
  onGroupByChange,
}: GroupControlProps) {
  const { t } = useTranslation();
  const isActive = groupBy !== "none";
  const activeLabel =
    groupBy === "labels" ? t("tasks:boardGroup.labels") : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none ring-0 ${
              isActive
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border bg-background text-foreground hover:bg-accent/60"
            }`}
          />
        }
      >
        <Group className="h-3 w-3" />
        {isActive ? activeLabel : t("tasks:boardGroup.label")}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            {t("tasks:boardGroup.groupBy")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onGroupByChange("none")}
          className="h-8 rounded-md text-sm"
        >
          <CheckSlot checked={groupBy === "none"} />
          {t("tasks:boardGroup.none")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onGroupByChange("labels")}
          className="h-8 rounded-md text-sm"
        >
          <CheckSlot checked={groupBy === "labels"} />
          {t("tasks:boardGroup.labels")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
