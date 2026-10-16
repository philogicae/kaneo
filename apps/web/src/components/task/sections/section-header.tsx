import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ title, meta, action }: SectionHeaderProps) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-2">
      <h3 className="font-medium text-[0.8125rem] text-foreground">{title}</h3>
      {meta}
      <span className="flex-1" />
      {action}
    </div>
  );
}
