import { createFileRoute, Outlet } from "@tanstack/react-router";
import Layout from "@/components/common/layout";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
