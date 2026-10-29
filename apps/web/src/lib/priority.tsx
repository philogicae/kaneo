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

// Hovering keeps the card's own priority hue instead of the theme ring (which
// is magenta in Volt): the border strengthens, a 2px inset ring thickens it and
// a matching soft glow makes the hovered card stand out.
export function getPriorityHoverClass(priority: string) {
  switch (priority) {
    case "urgent":
      return "hover:border-destructive hover:ring-2 hover:ring-inset hover:ring-destructive/30 hover:shadow-[0_0_18px_-2px_color-mix(in_srgb,var(--destructive)_45%,transparent)]";
    case "high":
      return "hover:border-warning hover:ring-2 hover:ring-inset hover:ring-warning/30 hover:shadow-[0_0_18px_-2px_color-mix(in_srgb,var(--warning)_45%,transparent)]";
    case "medium":
      return "hover:border-warning/80 hover:ring-2 hover:ring-inset hover:ring-warning/20 hover:shadow-[0_0_16px_-4px_color-mix(in_srgb,var(--warning)_40%,transparent)]";
    case "low":
      return "hover:border-info hover:ring-2 hover:ring-inset hover:ring-info/30 hover:shadow-[0_0_18px_-2px_color-mix(in_srgb,var(--info)_45%,transparent)]";
    default:
      return "hover:border-foreground/25 hover:ring-2 hover:ring-inset hover:ring-foreground/10";
  }
}
