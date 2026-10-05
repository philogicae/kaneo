import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, Link, RouterProvider } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import queryClient from "@/query-client";
import "@/index.css";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { KeyboardShortcutsHelp } from "./components/keyboard-shortcuts-help";
import AuthProvider from "./components/providers/auth-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { KeyboardShortcutsProvider } from "./hooks/use-keyboard-shortcuts";
import { AppI18nProvider } from "./lib/i18n/provider";
import { routeTree } from "./routeTree.gen";

console.log(`
                     ////////  
              /////  ////////  
            //////// ////////  
  //////// ///////// ///////   
  //////// ///////// //////    
  //////// ///////// ////      
  //////// ///////// ///       
  //////// ///////// /////     
  //////// ///////// //////    
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ////////            
  ////////  /////              
  ///////                      
                   
  
  All you need. Nothing you don't.
`);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFoundFallback,
  context: {
    user: null,
    queryClient,
  },
});

function App() {
  const { user } = useAuth();

  return <RouterProvider router={router} context={{ user }} />;
}

// Unmatched paths used to render a bare "Not Found" in the corner; give the
// 404 the same shell as the crash fallback and a way back into the app.
function NotFoundFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <p className="text-5xl font-semibold tracking-tight text-foreground">
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          {t("common:notFound.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common:notFound.description")}
        </p>
        <Link
          to="/dashboard"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="size-4" />
          {t("common:notFound.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}

// Root boundary fallback: shows a generic message and a refresh button,
// without rendering the raw error.message. The full error is still
// captured to Sentry by the boundary itself.
function RootCrashFallback({
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("common:error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common:error.description")}
        </p>
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("common:error.refreshPage")}
        </button>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary fallback={RootCrashFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AppI18nProvider>
                <KeyboardShortcutsProvider>
                  <App />
                  <KeyboardShortcutsHelp />
                </KeyboardShortcutsProvider>
              </AppI18nProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
