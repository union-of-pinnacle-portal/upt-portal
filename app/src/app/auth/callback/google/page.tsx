"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";
import EmailVerification from "supertokens-web-js/recipe/emailverification";

/**
 * Google redirects back to this page after OAuth.
 * Exchanges the code for a session, then sends the user on: unverified
 * addresses to /auth/verify-email, everyone else to /dashboard. Every exit
 * path navigates — leaving the user on this page strands them on a spinner.
 */
export default function GoogleCallbackPage() {
  const router = useRouter();
  // The OAuth code is single-use, so Strict Mode's double-effect in dev would
  // spend it on the first call and fail the second. Run the exchange once.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function handleCallback() {
      try {
        const response = await ThirdParty.signInAndUp();

        if (response.status !== "OK") {
          router.replace("/auth/login?error=oauth_failed");
          return;
        }

        const verification = await EmailVerification.isEmailVerified();
        if (!verification.isVerified) {
          router.replace("/auth/verify-email");
          return;
        }

        router.replace("/dashboard");
      } catch {
        router.replace("/auth/login?error=oauth_failed");
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
