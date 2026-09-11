"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";

/**
 * Send anyone who isn't signed in back to the login screen.
 *
 * Both station pages opened with the same nine-line effect. Returns what the
 * caller then needs anyway — the user, and whether auth is still resolving —
 * so the page can render its loading state without calling `useAuth` twice.
 */
export function useRequireAuth() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  return { user, isLoading };
}
