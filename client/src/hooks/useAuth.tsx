import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "../lib/trpc";

interface AuthContextValue {
  authed: boolean;
  loading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue>({ authed: false, loading: true, refetch: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const statusQuery = trpc.auth.status.useQuery(undefined, { retry: false });

  return (
    <AuthContext.Provider
      value={{
        authed: statusQuery.data?.authed ?? false,
        loading: statusQuery.isLoading,
        refetch: () => statusQuery.refetch(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
