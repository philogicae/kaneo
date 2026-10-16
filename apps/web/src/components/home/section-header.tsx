import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ title, detail, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b pb-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="font-semibold text-[0.9375rem] text-foreground">
          {title}
        </h2>
        {detail && (
          <span className="truncate text-[0.8125rem] text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
