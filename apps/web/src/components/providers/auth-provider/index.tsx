import { createContext, type PropsWithChildren, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import type { User } from "@/types/user";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: undefined,
  isLoading: true,
  refetchUser: async () => {},
});

function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, refetch } = useSession();
  // Only show the loading skeleton during the *first* session fetch. Better
  // Auth re-fetches the session on window focus; if we kept returning the
  // skeleton while those background fetches are pending we'd unmount the
  // entire route tree on every alt-tab, which tore down the Turnstile
  // iframe and forced a re-challenge.
  const previousOwner = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending || error) return;
    const owner = data?.user.id ?? null;
    if (previousOwner.current !== owner) descriptionSaveQueue.clear();
    previousOwner.current = owner;
  }, [data?.user.id, isPending]);
  const hasLoadedOnce = useRef(false);
  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  if (isPending && !hasLoadedOnce.current) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: (data?.user as User | null | undefined) ?? null,
        isLoading: isPending,
        refetchUser: async () => {
          await refetch({ query: { disableCookieCache: true } });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
