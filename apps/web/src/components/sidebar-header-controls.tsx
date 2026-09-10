import { Link } from "@tanstack/react-router";
import type * as React from "react";

import NotificationDropdown from "@/components/notification/notification-dropdown";
import { UserAvatar } from "@/components/user-avatar";

// App wordmark where the workspace switcher used to sit. Uppercase with wide
// tracking reads as a display wordmark; the gradient uses the theme's
// primary/chart pair so it reads in every theme (volt included). Clicking it
// returns to the unified dashboard, the default view of the app.
function AppWordmark() {
  return (
    <Link
      className="font-heading bg-linear-to-r from-foreground/85 to-foreground/40 bg-clip-text text-base font-bold tracking-[0.2em] text-transparent uppercase hover:from-foreground hover:to-foreground/60 group-data-[collapsible=icon]:hidden"
      to="/"
    >
      Kaneo
    </Link>
  );
}

// Collapsed rail: a compact gradient "K" mark stands in for the wordmark.
function AppMark() {
  return (
    <Link
      aria-hidden="true"
      className="font-heading hidden size-8 shrink-0 items-center justify-center bg-linear-to-br from-foreground/85 to-foreground/40 bg-clip-text text-base font-bold text-transparent uppercase group-data-[collapsible=icon]:flex"
      to="/"
    >
      K
    </Link>
  );
}

export function SidebarHeaderControls(
  props: React.ComponentProps<"div">,
): React.ReactElement {
  return (
    <div
      className="flex w-full items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center"
      {...props}
    >
      <AppWordmark />
      <AppMark />
      <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <NotificationDropdown />
        <div className="h-8 w-8 shrink-0">
          <UserAvatar />
        </div>
      </div>
    </div>
  );
}
