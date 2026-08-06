"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";

/**
 * Google redirects back to this page after OAuth.
 * After sign in/up, checks if the user has completed setup.
 * New users (setupComplete not set) go to /auth/setup.
 * Returning users go straight to /dashboard.
 */
export default function GoogleCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const response = await ThirdParty.signInAndUp();

      if (response.status !== "OK") {
        router.push("/auth/login?error=oauth_failed");
        return;
      }

      // Check if this user has completed the setup flow
      try {
        const res = await fetch("/api/auth/check-setup");
        const data = await res.json();
        if (data.setupComplete) {
          router.push("/dashboard");
        } else {
          router.push("/auth/setup");
        }
      } catch {
        // Fallback to setup if check fails
        router.push("/auth/setup");
      }
    }
    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
