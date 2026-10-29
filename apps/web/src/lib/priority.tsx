import { Minus } from "lucide-react";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";

export function getPriorityIcon(priority: string) {
  if (!priority || priority === "no-priority") {
    return <Minus className="size-3.5 text-muted-foreground" />;
  }
  return <PriorityGlyph priority={priority} />;
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
