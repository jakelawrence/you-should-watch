"use client";

import { createContext, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Amplify } from "aws-amplify";
import { Hub } from "aws-amplify/utils";
import "aws-amplify/auth/enable-oauth-listener";
import outputs from "@amplify-outputs";
import { safeReturnTo, signOutUser } from "../lib/authClient";

// Configure once, before any auth call. ssr: true stores tokens in cookies so the Next.js server
// (API routes, middleware) can verify the same session.
Amplify.configure(outputs, { ssr: true });

export const AuthContext = createContext(null);

function AuthState({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // The server is the source of truth for who is signed in (it also resolves username/admin).
  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
    return Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signedOut":
        case "tokenRefresh_failure":
          refreshAuth();
          router.refresh();
          break;
        case "customOAuthState":
          // Google sign-in returns to "/"; continue to where the user started.
          router.replace(safeReturnTo(payload.data));
          break;
      }
    });
  }, [refreshAuth, router]);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, logout, refreshAuth }),
    [user, isLoading, logout, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function AuthProvider({ children }) {
  return (
    <Suspense>
      <AuthState>{children}</AuthState>
    </Suspense>
  );
}
