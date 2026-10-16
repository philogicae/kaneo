import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleAlert,
  Minus,
} from "lucide-react";

export function getPriorityIcon(priority: string) {
  switch (priority) {
    case "urgent":
      return <CircleAlert className="h-[12px] w-[12px] text-destructive" />;
    case "high":
      return (
        <ChevronsUp className="h-[12px] w-[12px] text-warning-foreground" />
      );
    case "medium":
      return (
        <ChevronUp className="h-[12px] w-[12px] text-warning-foreground/80" />
      );
    case "low":
      return (
        <ChevronDown className="h-[12px] w-[12px] text-info-foreground/85" />
      );
    case "no-priority":
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
    default:
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
  }
}

// Companion of getPriorityIcon: the card border carries the same hue as the
// priority chevrons, softer than the icon so it reads as an accent.
export function getPriorityBorderClass(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-destructive/60";
    case "high":
      return "border-warning/60";
    case "medium":
      return "border-warning/40";
    case "low":
      return "border-info/50";
    default:
      return "border-border";
  }
}
